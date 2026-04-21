import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common'

import { COOKIE_DEVICE_ID_NAME } from '@config'
import { helper, hs, timestamp } from '@neptunysform-inc/utils'
import { GqlExecutionContext } from '@nestjs/graphql'
import { AuthService, UserService } from '@service'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context)
    let { req } = ctx.getContext()

    if (helper.isEmpty(req)) {
      req = context.switchToHttp().getRequest()
    }

    const deviceId = req.get('x-device-id') || req.cookies[COOKIE_DEVICE_ID_NAME]
    const user = this.authService.getSession(req)

    if (helper.isValid(user)) {
      if (deviceId !== user.deviceId) {
        throw new ForbiddenException('Forbidden request error')
      }

      const isExpired = await this.authService.isExpired(user.id, user.deviceId, user.rememberMe)

      if (!isExpired) {
        const detail = await this.userService.findById(user.id)

        if (helper.isValid(detail)) {
          req.user = detail

          const now = timestamp()
          const expire = hs(AuthService.sessionDuration(user.rememberMe))

          if (now - Number(user.loginAt) > expire / 2) {
            await this.authService.renew(user.id, user.deviceId, user.rememberMe)
            this.authService.setSession(req.res, {
              ...user,
              loginAt: now
            }, AuthService.sessionDuration(user.rememberMe))
          }

          return true
        }
      }
    }

    throw new UnauthorizedException('Unauthorized')
  }
}
