import { BadRequestException, UseGuards } from '@nestjs/common'

import { GraphqlResponse } from '@decorator'
import { APP_DISABLE_REGISTRATION, BCRYPT_SALT, VERIFY_USER_EMAIL } from '@environments'
import { SignUpInput, SignUpResult } from '@graphql'
import { DeviceIdGuard } from '@guard'
import { helper } from '@neptunysform-inc/utils'
import { UserActivityKindEnum } from '@model'
import { Args, Mutation, Resolver } from '@nestjs/graphql'
import { AuthService, PendingUserRegistrationService, MailService, UserService } from '@service'
import { ClientInfo, GqlClient, gravatar, passwordHash } from '@utils'
import { isDisposableEmail } from '@utils'

@Resolver()
@UseGuards(DeviceIdGuard)
export class SignUpResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly pendingUserRegistrationService: PendingUserRegistrationService,
    private readonly userService: UserService,
    private readonly mailService: MailService
  ) {}

  @Mutation(returns => SignUpResult)
  async signUp(
    @GqlClient() client: ClientInfo,
    @GraphqlResponse() res: any,
    @Args('input') input: SignUpInput
  ): Promise<SignUpResult> {
    if (APP_DISABLE_REGISTRATION) {
      throw new BadRequestException('Error: Registration is disabled')
    }

    if (isDisposableEmail(input.email)) {
      throw new BadRequestException(
        'Error: Disposable email address detected, please use a work email to create the account'
      )
    }

    const existUser = await this.userService.findByEmail(input.email)

    if (helper.isValid(existUser)) {
      throw new BadRequestException('The email address already exist')
    }

    if (this.pendingUserRegistrationService.isApprovalRequired(input.email)) {
      await this.pendingUserRegistrationService.requestApproval({
        name: input.name,
        email: input.email,
        password: await passwordHash(input.password, BCRYPT_SALT),
        avatar: gravatar(input.email),
        lang: client.lang,
        isEmailVerified: !VERIFY_USER_EMAIL
      })

      return {
        success: true,
        requiresAdminApproval: true,
        requiresEmailVerification: false
      }
    }

    const userId = await this.userService.create({
      name: input.name,
      email: input.email,
      password: await passwordHash(input.password, BCRYPT_SALT),
      avatar: gravatar(input.email),
      lang: client.lang,
      isEmailVerified: !VERIFY_USER_EMAIL
    })

    this.authService.createUserActivity({
      kind: UserActivityKindEnum.SIGN_UP,
      userId,
      ...client
    })

    await this.authService.login({
      res,
      userId,
      deviceId: client.deviceId
    })

    if (VERIFY_USER_EMAIL) {
      const code = await this.authService.getVerificationCodeWithRateLimit(`verify_email:${userId}`)
      await this.mailService.emailVerificationRequest(input.email, code)
    }

    return {
      success: true,
      requiresAdminApproval: false,
      requiresEmailVerification: VERIFY_USER_EMAIL
    }
  }
}
