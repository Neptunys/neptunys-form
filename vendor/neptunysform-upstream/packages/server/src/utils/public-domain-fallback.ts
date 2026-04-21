import { helper } from '@neptunysform-inc/utils'

import { APP_HOMEPAGE_URL, COOKIE_DOMAIN } from '@environments'

const PUBLIC_DOMAIN_ROOT_FORM_FALLBACKS: Record<string, string> = {}

const CONFIGURED_RUNTIME_HOSTS = [APP_HOMEPAGE_URL, COOKIE_DOMAIN]
  .map(value => normalizeDomainHostname(value))
  .filter((value): value is string => helper.isValid(value))

function normalizeDomainHostname(value?: string) {
  if (!helper.isValid(value)) {
    return undefined
  }

  return value!
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/:\d+$/, '')
    .replace(/\/.*$/, '')
    .replace(/\.+$/, '')
}

export function getPublicDomainRootFallbackFormId(hostname?: string, slug?: string) {
  if (helper.isValid(slug)) {
    return undefined
  }

  const normalizedHostname = normalizeDomainHostname(hostname)

  if (!normalizedHostname) {
    return undefined
  }

  return PUBLIC_DOMAIN_ROOT_FORM_FALLBACKS[normalizedHostname]
}

export function hasPublicDomainRootFallbackHost(hostname?: string) {
  const normalizedHostname = normalizeDomainHostname(hostname)

  if (!normalizedHostname) {
    return false
  }

  if (CONFIGURED_RUNTIME_HOSTS.includes(normalizedHostname)) {
    return true
  }

  return helper.isValid(getPublicDomainRootFallbackFormId(normalizedHostname))
}
