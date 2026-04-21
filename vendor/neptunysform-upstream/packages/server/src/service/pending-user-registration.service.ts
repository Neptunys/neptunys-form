import { SocialLoginTypeEnum } from '@neptunysform-inc/shared-types-enums'
import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { AuthService } from './auth.service'
import { MailService } from './mail.service'
import { UserService } from './user.service'
import { ADMIN_APPROVAL_EMAIL, APP_HOMEPAGE_URL, VERIFY_USER_EMAIL } from '@environments'
import { helper, nanoid, timestamp } from '@neptunysform-inc/utils'
import { PendingUserRegistrationModel, UserSocialAccountModel } from '@model'

interface PendingRegistrationInput {
  email: string
  name: string
  password?: string
  avatar?: string
  lang?: string
  socialKind?: SocialLoginTypeEnum
  socialOpenId?: string
  isEmailVerified?: boolean
}

@Injectable()
export class PendingUserRegistrationService {
  constructor(
    @InjectModel(PendingUserRegistrationModel.name)
    private readonly pendingUserRegistrationModel: Model<PendingUserRegistrationModel>,
    @InjectModel(UserSocialAccountModel.name)
    private readonly userSocialAccountModel: Model<UserSocialAccountModel>,
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly mailService: MailService
  ) {}

  private static signInMethodLabel(kind?: SocialLoginTypeEnum): string {
    switch (kind) {
      case SocialLoginTypeEnum.APPLE:
        return 'Apple'

      case SocialLoginTypeEnum.GOOGLE:
      case SocialLoginTypeEnum.GOOGLE_ONE_TAP:
        return 'Google'

      default:
        return 'Email and password'
    }
  }

  public isApprovalRequired(email?: string): boolean {
    return helper.isValid(ADMIN_APPROVAL_EMAIL) && email?.toLowerCase() !== ADMIN_APPROVAL_EMAIL
  }

  public async findByEmail(email: string): Promise<PendingUserRegistrationModel | null> {
    return this.pendingUserRegistrationModel.findOne({
      email: email.toLowerCase()
    })
  }

  public async requestApproval(
    input: PendingRegistrationInput
  ): Promise<PendingUserRegistrationModel> {
    if (!this.isApprovalRequired(input.email)) {
      throw new BadRequestException('Admin approval is not required for this email address.')
    }

    const normalizedEmail = input.email.toLowerCase()
    const approvalToken = nanoid(40)
    const filters: Array<Record<string, any>> = [{ email: normalizedEmail }]

    if (helper.isValid(input.socialKind) && helper.isValid(input.socialOpenId)) {
      filters.push({
        socialKind: input.socialKind,
        socialOpenId: input.socialOpenId
      })
    }

    await this.pendingUserRegistrationModel.deleteMany({
      $or: filters
    })

    const request = await this.pendingUserRegistrationModel.create({
      ...input,
      email: normalizedEmail,
      approvalToken,
      requestedAt: timestamp()
    })

    const approvalLink = `${APP_HOMEPAGE_URL}/registration-requests/${approvalToken}/approve`

    await this.mailService.adminRegistrationApprovalRequest(ADMIN_APPROVAL_EMAIL, {
      approvalLink,
      requestedEmail: normalizedEmail,
      requestedName: input.name,
      signInMethod: PendingUserRegistrationService.signInMethodLabel(input.socialKind)
    })

    return request
  }

  public async approveByToken(token: string): Promise<{ email: string }> {
    const request = await this.pendingUserRegistrationModel.findOne({
      approvalToken: token
    })

    if (!request) {
      throw new BadRequestException('This approval link is invalid or has already been used.')
    }

    const existingUser = await this.userService.findByEmail(request.email)
    let userId = existingUser?.id

    if (!userId) {
      userId = await this.userService.create({
        name: request.name,
        email: request.email,
        password: request.password,
        avatar: request.avatar,
        lang: request.lang,
        isEmailVerified:
          Boolean(request.isEmailVerified) || Boolean(request.socialKind) || !VERIFY_USER_EMAIL
      })
    }

    if (request.socialKind && request.socialOpenId) {
      const existingAccount = await this.userSocialAccountModel.findOne({
        kind: request.socialKind,
        openId: request.socialOpenId
      })

      if (!existingAccount) {
        await this.userSocialAccountModel.create({
          kind: request.socialKind,
          openId: request.socialOpenId,
          userId
        })
      }
    }

    await this.pendingUserRegistrationModel.deleteOne({
      _id: request.id
    })

    if (!existingUser && VERIFY_USER_EMAIL && !request.socialKind) {
      const code = await this.authService.getVerificationCodeWithRateLimit(`verify_email:${userId}`)
      await this.mailService.emailVerificationRequest(request.email, code)
    }

    await this.mailService.registrationApproved(request.email, {
      fullName: request.name,
      loginLink: `${APP_HOMEPAGE_URL}/login?email=${encodeURIComponent(request.email)}`
    })

    return {
      email: request.email
    }
  }
}