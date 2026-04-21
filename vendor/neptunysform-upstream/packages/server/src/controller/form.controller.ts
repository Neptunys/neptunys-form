import { Controller, Get, Param, Req, Res } from '@nestjs/common'
import { Request, Response } from 'express'

import {
  APP_HOMEPAGE_URL,
  COOKIE_DOMAIN,
  ENABLE_GOOGLE_FONTS,
  GOOGLE_RECAPTCHA_KEY,
  STRIPE_PUBLISHABLE_KEY
} from '@environments'
import { TeamService } from '@service'
import { hasPublicDomainRootFallbackHost } from '@utils'

@Controller()
export class FormController {
  constructor(private readonly teamService: TeamService) {}

  private async runtimeConfig(hostname?: string) {
    return {
      neptunysform: {
        homepageURL: APP_HOMEPAGE_URL,
        websiteURL: APP_HOMEPAGE_URL,
        customDomainRuntime: await this.isCustomDomainHost(hostname),
        cookieDomain: COOKIE_DOMAIN,
        enableGoogleFonts: ENABLE_GOOGLE_FONTS,
        stripePublishableKey: STRIPE_PUBLISHABLE_KEY,
        googleRecaptchaKey: GOOGLE_RECAPTCHA_KEY
      }
    }
  }

  private async isCustomDomainHost(hostname?: string) {
    if (!hostname) {
      return false
    }

    if (hasPublicDomainRootFallbackHost(hostname)) {
      return true
    }

    return !!(await this.teamService.findByCustomDomain(hostname.toLowerCase()))
  }

  @Get('/form/:formId')
  async index(@Req() req: Request, @Res() res: Response) {
    return res.render('index', await this.runtimeConfig(req.hostname))
  }

  @Get('/x/:experimentId')
  async experiment(@Req() req: Request, @Res() res: Response) {
    return res.render('index', await this.runtimeConfig(req.hostname))
  }

  @Get('/:slug')
  async customDomainSlug(@Req() req: Request, @Param('slug') _slug: string, @Res() res: Response) {
    if (!(await this.isCustomDomainHost(req.hostname))) {
      return res.status(404).send('Not Found')
    }

    return res.render('index', await this.runtimeConfig(req.hostname))
  }
}
