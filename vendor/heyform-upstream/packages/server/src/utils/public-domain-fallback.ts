import { helper } from '@heyform-inc/utils'

const PUBLIC_DOMAIN_ROOT_FORM_FALLBACKS: Record<string, string> = {}

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
  return helper.isValid(getPublicDomainRootFallbackFormId(hostname))
}
