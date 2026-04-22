import { CookieOptions } from 'express'

import { COOKIE_DOMAIN, COOKIE_MAX_AGE, NODE_ENV, SESSION_MAX_AGE } from '@environments'
import { ms } from '@neptunysform-inc/utils'

function resolveCookieDomain() {
  const normalized = String(COOKIE_DOMAIN || '').toLowerCase().trim()

  if (!normalized || normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1') {
    // Host-only cookies are required for local dev so both localhost and 127.0.0.1 work reliably.
    return undefined
  }

  return COOKIE_DOMAIN
}

const commonOptions = {
  domain: resolveCookieDomain(),
  sameSite: 'lax',
  signed: false,
  secure: NODE_ENV === 'production'
}

export const COOKIE_SESSION_NAME = 'NEPTUNYSFORM_SESSION'
export const COOKIE_LOGIN_IN_NAME = 'NEPTUNYSFORM_LOGGED_IN'
export const COOKIE_DEVICE_ID_NAME = 'NEPTUNYSFORM_DEVICE_ID'

export function CookieOptionsFactory(options?: CookieOptions): CookieOptions {
  return {
    maxAge: ms(COOKIE_MAX_AGE),
    ...commonOptions,
    ...options
  } as any
}

export function SessionOptionsFactory(options?: CookieOptions): CookieOptions {
  return {
    maxAge: ms(SESSION_MAX_AGE),
    httpOnly: true,
    ...commonOptions,
    ...options
  } as any
}
