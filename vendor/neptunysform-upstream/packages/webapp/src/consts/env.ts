import { helper } from '@neptunysform-inc/utils'

export const DEVICEID_COOKIE_NAME = 'NEPTUNYSFORM_DEVICE_ID'
export const LOGGED_COOKIE_NAME = 'NEPTUNYSFORM_LOGGED_IN'
export const LOCALE_COOKIE_NAME = 'NEPTUNYSFORM_LOCALE'
export const REDIRECT_COOKIE_NAME = 'NEPTUNYSFORM_REDIRECT'

export const HOMEPAGE_URL =
  window.neptunysform?.homepageURL || (import.meta.env.VITE_DASHBOARD_URL as string)
export const DASHBOARD_URL = HOMEPAGE_URL
export const WEBSITE_URL =
  window.neptunysform?.websiteURL || (import.meta.env.VITE_HOMEPAGE_URL as string)

export const GRAPHQL_API_URL = import.meta.env.VITE_GRAPHQL_API_URL as string
export const CDN_UPLOAD_URL = import.meta.env.VITE_CDN_UPLOAD_URL as string

export const COOKIE_DOMAIN =
  window.neptunysform?.cookieDomain || (import.meta.env.VITE_COOKIE_DOMAIN as string)

export const STRIPE_PUBLISHABLE_KEY =
  window.neptunysform?.stripePublishableKey || (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string)
export const GOOGLE_RECAPTCHA_KEY =
  window.neptunysform?.googleRecaptchaKey || (import.meta.env.VITE_GOOGLE_RECAPTCHA_KEY as string)

export const DISABLE_LOGIN_WITH_GOOGLE = helper.isTrue(
  window.neptunysform?.disableLoginWithGoogle || import.meta.env.VITE_DISABLE_LOGIN_WITH_GOOGLE
)
export const DISABLE_LOGIN_WITH_APPLE = helper.isTrue(
  window.neptunysform?.disableLoginWithApple || import.meta.env.VITE_DISABLE_LOGIN_WITH_APPLE
)
export const VERIFY_USER_EMAIL = helper.isTrue(
  window.neptunysform?.verifyUserEmail || import.meta.env.VITE_VERIFY_USER_EMAIL
)
export const ENABLE_GOOGLE_FONTS = helper.isTrue(
  window.neptunysform?.enableGoogleFonts ?? import.meta.env.VITE_ENABLE_GOOGLE_FONTS ?? 'true'
)

export function isRegistrationDisabled() {
  return helper.isTrue(window.neptunysform?.appDisableRegistration)
}

export function getVerifyEmailResendCooldownSeconds() {
  const value = Number(window.neptunysform?.verifyEmailResendCooldownSeconds)
  return Number.isFinite(value) && value > 0 ? value : 60
}

export const TEMPLATES_URL =
  window.neptunysform?.templatesURL || (import.meta.env.VITE_TEMPLATES_URL as string)
export const HELP_CENTER_URL =
  window.neptunysform?.helpCenterURL || (import.meta.env.VITE_HELP_CENTER_URL as string)

export const IS_PROD = import.meta.env.NODE_ENV === 'production'
export const PACKAGE_VERSION = import.meta.env.PACKAGE_VERSION

export const COOKIE_OPTIONS: AnyMap = {
  expires: 365,
  sameSite: 'strict',
  domain: COOKIE_DOMAIN,
  secure: IS_PROD
}

if (window.neptunysform) {
  window.neptunysform.enableGoogleFonts = ENABLE_GOOGLE_FONTS
}
