import { Controller, Get, Param, Res } from '@nestjs/common'

import { APP_HOMEPAGE_URL } from '@environments'
import { PendingUserRegistrationService } from '@service'

@Controller()
export class RegistrationApprovalController {
  constructor(
    private readonly pendingUserRegistrationService: PendingUserRegistrationService
  ) {}

  @Get('/registration-requests/:token/approve')
  async approve(@Param('token') token: string, @Res() res: any) {
    try {
      const result = await this.pendingUserRegistrationService.approveByToken(token)

      return res.redirect(
        302,
        `${APP_HOMEPAGE_URL}/login?approval=approved&email=${encodeURIComponent(result.email)}`
      )
    } catch {
      return res.redirect(302, `${APP_HOMEPAGE_URL}/login?approval=invalid`)
    }
  }
}