import { Auth, User } from '@decorator'
import { UserDetailType } from '@graphql'
import { helper } from '@heyform-inc/utils'
import { UserLangEnum, UserModel } from '@model'
import { Query, Resolver } from '@nestjs/graphql'
import { SocialLoginService } from '@service'

const { isValid } = helper

@Resolver()
@Auth()
export class UserDetailResolver {
  constructor(private readonly socialLoginService: SocialLoginService) {}

  @Query(returns => UserDetailType)
  async userDetail(@User() user: UserModel): Promise<UserDetailType> {
    let isSocialAccount = false

    try {
      const result = await this.socialLoginService.findByUserId(user.id)
      isSocialAccount = isValid(result)
    } catch (_) {}

    const lang = Object.values(UserLangEnum).includes(user.lang as UserLangEnum)
      ? user.lang
      : undefined

    return {
      id: user.id,
      name: user.name || '',
      email: user.email || '',
      avatar: user.avatar,
      lang,
      isEmailVerified: Boolean(user.isEmailVerified),
      isSocialAccount,
      isDeletionScheduled: Boolean(user.isDeletionScheduled),
      deletionScheduledAt: Number(user.deletionScheduledAt || 0)
    }
  }
}
