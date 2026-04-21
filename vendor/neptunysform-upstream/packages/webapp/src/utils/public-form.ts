import { WEBSITE_URL } from '@/consts'
import { helper, slugify } from '@neptunysform-inc/utils'

interface BuildPublicFormUrlOptions {
  sharingURLPrefix: string
  formId?: string
  slug?: string
  isDomainRoot?: boolean
  customDomain?: string
}

export function normalizeCustomDomain(value?: string) {
  if (!helper.isValid(value)) {
    return undefined
  }

  let normalized = value!.trim().toLowerCase()
  normalized = normalized.replace(/^https?:\/\//, '')
  normalized = normalized.replace(/\/.*$/, '')
  normalized = normalized.replace(/\.+$/, '')

  return normalized || undefined
}

export function normalizePublicFormSlug(value?: string) {
  if (!helper.isValid(value)) {
    return undefined
  }

  const normalized = slugify(value!, {
    replacement: '-',
    lower: true,
    strict: true,
    trim: true
  })
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || undefined
}

export function buildPublicFormPath({ formId, slug, isDomainRoot, customDomain }: BuildPublicFormUrlOptions) {
  if (helper.isValid(customDomain)) {
    if (isDomainRoot) {
      return '/'
    }

    const normalizedSlug = normalizePublicFormSlug(slug)

    if (helper.isValid(normalizedSlug)) {
      return `/${normalizedSlug}`
    }
  }

  return `/form/${formId}`
}

export function buildPublicFormUrl(options: BuildPublicFormUrlOptions) {
  const baseUrl = options.sharingURLPrefix.replace(/\/+$/, '')
  const path = buildPublicFormPath(options)

  return path === '/' ? baseUrl : `${baseUrl}${path}`
}

export function getConfiguredWebsiteHostname() {
  try {
    return new URL(WEBSITE_URL).hostname.toLowerCase()
  } catch (_) {
    return undefined
  }
}

export function isLocalHostname(hostname?: string) {
  const normalizedHostname = hostname?.toLowerCase()
  return normalizedHostname === 'localhost' || normalizedHostname === '127.0.0.1'
}

export function isCustomDomainRuntimeCandidate(hostname = window.location.hostname) {
  if (typeof window.neptunysform?.customDomainRuntime !== 'undefined') {
    return helper.isTrue(window.neptunysform.customDomainRuntime)
  }

  const normalizedHostname = hostname.toLowerCase()
  const configuredHostname = getConfiguredWebsiteHostname()

  if (isLocalHostname(normalizedHostname)) {
    return false
  }

  if (configuredHostname) {
    return normalizedHostname !== configuredHostname
  }

  return !isLocalHostname(normalizedHostname)
}