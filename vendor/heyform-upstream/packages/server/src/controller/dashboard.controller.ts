import { Controller, Get, Header, Req, Res } from '@nestjs/common'
import { Request, Response } from 'express'

import {
  APP_DISABLE_REGISTRATION,
  APP_HOMEPAGE_URL,
  COOKIE_DOMAIN,
  ENABLE_GOOGLE_FONTS,
  GOOGLE_RECAPTCHA_KEY,
  STRIPE_PUBLISHABLE_KEY,
  VERIFY_EMAIL_RESEND_COOLDOWN
} from '@environments'
import { hs } from '@heyform-inc/utils'
import { TeamService } from '@service'
import { hasPublicDomainRootFallbackHost } from '@utils'

@Controller()
export class DashboardController {
  constructor(private readonly teamService: TeamService) {}

  private async isCustomDomainHost(hostname?: string) {
    if (!hostname) {
      return false
    }

    if (hasPublicDomainRootFallbackHost(hostname)) {
      return true
    }

    return !!(await this.teamService.findByCustomDomain(hostname.toLowerCase()))
  }

  private async runtimeConfig(hostname?: string) {
    return {
      homepageURL: APP_HOMEPAGE_URL,
      websiteURL: APP_HOMEPAGE_URL,
      customDomainRuntime: await this.isCustomDomainHost(hostname),
      appDisableRegistration: APP_DISABLE_REGISTRATION,
      cookieDomain: COOKIE_DOMAIN,
      enableGoogleFonts: ENABLE_GOOGLE_FONTS,
      stripePublishableKey: STRIPE_PUBLISHABLE_KEY,
      googleRecaptchaKey: GOOGLE_RECAPTCHA_KEY,
      verifyEmailResendCooldownSeconds: Math.ceil(hs(VERIFY_EMAIL_RESEND_COOLDOWN) / 1000)
    }
  }

  @Get('/api/config')
  async config(@Req() req: Request) {
    return this.runtimeConfig(req.hostname)
  }

  @Get('/sign-up')
  signUp(@Req() req: Request, @Res() res: Response) {
    if (APP_DISABLE_REGISTRATION) {
      return res.redirect(302, '/login')
    }

    return this.index(req, res)
  }

  @Get([
    '/',
    '/dashboard',
    '/dashboard/*',
    '/login',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
    '/oauth/authorize',
    '/workspace/create',
    '/workspace',
    '/workspace/*'
  ])
  @Header('X-Frame-Options', 'SAMEORIGIN')
  async index(@Req() req: Request, @Res() res: Response) {
    const customDomainWorkspace = await this.isCustomDomainHost(req.hostname)
    const runtimeConfig = await this.runtimeConfig(req.hostname)

    if (customDomainWorkspace) {
      return res.render('index', {
        heyform: runtimeConfig
      })
    }

    return res.render('index', {
      title: 'NeptunysForm Dashboard - Create and Manage Custom Forms Effortlessly',
      description:
        "Simplify your form creation process with NeptunysForm's intuitive dashboard. Design, customize, and manage forms all in one place, with no coding required.",
      heyform: runtimeConfig
    })
  }
}
