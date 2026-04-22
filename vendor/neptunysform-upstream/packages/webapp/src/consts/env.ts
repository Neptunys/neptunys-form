import { helper } from '@neptunysform-inc/utils'

function getRuntimeBool(runtimeValue: unknown, envValue: unknown) {
  return helper.isTrue(runtimeValue ?? envValue)
}

function getRuntimeString(runtimeValue: unknown, envValue: unknown) {
  return (runtimeValue || envValue || '') as string
}

function resolveClientCookieDomain(cookieDomain: string) {
  const host = String(window.location.hostname || '').toLowerCase().trim()
  const domain = String(cookieDomain || '').toLowerCase().trim()
  const isLocalHost = (value: string) => value === 'localhost' || value === '127.0.0.1' || value === '::1'

  if (!domain || isLocalHost(domain) || isLocalHost(host)) {
    // Keep cookies host-only in local dev; explicit domains here cause drops across localhost/127.0.0.1.
    return undefined
  }

  return cookieDomain
}

export const DEVICEID_COOKIE_NAME = 'NEPTUNYSFORM_DEVICE_ID'
export const LOGGED_COOKIE_NAME = 'NEPTUNYSFORM_LOGGED_IN'
export const LOCALE_COOKIE_NAME = 'NEPTUNYSFORM_LOCALE'
export const REDIRECT_COOKIE_NAME = 'NEPTUNYSFORM_REDIRECT'

export let HOMEPAGE_URL = ''
export let DASHBOARD_URL = ''
export let WEBSITE_URL = ''

export const GRAPHQL_API_URL = import.meta.env.VITE_GRAPHQL_API_URL as string
export const CDN_UPLOAD_URL = import.meta.env.VITE_CDN_UPLOAD_URL as string

export let COOKIE_DOMAIN = ''

export let STRIPE_PUBLISHABLE_KEY = ''
export let GOOGLE_RECAPTCHA_KEY = ''

export let DISABLE_LOGIN_WITH_GOOGLE = false
export let DISABLE_LOGIN_WITH_APPLE = false
export let VERIFY_USER_EMAIL = false
export let ENABLE_GOOGLE_FONTS = false

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

export let COOKIE_OPTIONS: AnyMap = {
  expires: 365,
  sameSite: 'strict',
  domain: resolveClientCookieDomain(COOKIE_DOMAIN),
  secure: IS_PROD
}

export function refreshRuntimeEnv() {
  HOMEPAGE_URL = getRuntimeString(window.neptunysform?.homepageURL, import.meta.env.VITE_DASHBOARD_URL)
  DASHBOARD_URL = HOMEPAGE_URL
  WEBSITE_URL = getRuntimeString(window.neptunysform?.websiteURL, import.meta.env.VITE_HOMEPAGE_URL)
  COOKIE_DOMAIN = getRuntimeString(window.neptunysform?.cookieDomain, import.meta.env.VITE_COOKIE_DOMAIN)
  STRIPE_PUBLISHABLE_KEY = getRuntimeString(
    window.neptunysform?.stripePublishableKey,
    import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  )
  GOOGLE_RECAPTCHA_KEY = getRuntimeString(
    window.neptunysform?.googleRecaptchaKey,
    import.meta.env.VITE_GOOGLE_RECAPTCHA_KEY
  )
  DISABLE_LOGIN_WITH_GOOGLE = getRuntimeBool(
    window.neptunysform?.disableLoginWithGoogle,
    import.meta.env.VITE_DISABLE_LOGIN_WITH_GOOGLE
  )
  DISABLE_LOGIN_WITH_APPLE = getRuntimeBool(
    window.neptunysform?.disableLoginWithApple,
    import.meta.env.VITE_DISABLE_LOGIN_WITH_APPLE
  )
  VERIFY_USER_EMAIL = getRuntimeBool(
    window.neptunysform?.verifyUserEmail,
    import.meta.env.VITE_VERIFY_USER_EMAIL
  )
  ENABLE_GOOGLE_FONTS = getRuntimeBool(
    window.neptunysform?.enableGoogleFonts,
    import.meta.env.VITE_ENABLE_GOOGLE_FONTS ?? 'true'
  )
  COOKIE_OPTIONS = {
    expires: 365,
    sameSite: 'strict',
    domain: resolveClientCookieDomain(COOKIE_DOMAIN),
    secure: IS_PROD
  }

  if (window.neptunysform) {
    window.neptunysform.enableGoogleFonts = ENABLE_GOOGLE_FONTS
  }
}

refreshRuntimeEnv()
