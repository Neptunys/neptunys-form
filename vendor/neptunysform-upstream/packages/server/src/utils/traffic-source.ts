import { helper } from '@neptunysform-inc/utils'

export const TRAFFIC_SOURCE_LABELS = {
  direct: 'Direct',
  meta: 'Meta',
  google: 'Google',
  linkedin: 'LinkedIn',
  x: 'X',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  email: 'Email',
  other: 'Other'
} as const

export type TrafficSourceChannel = keyof typeof TRAFFIC_SOURCE_LABELS

export interface TrafficSourceRecord {
  landingUrl?: string
  referrer?: string
  channel?: string
  utmSource?: string
  utmMedium?: string
}

function normalizeText(value: unknown): string | undefined {
  if (helper.isNil(value)) {
    return undefined
  }

  const normalized = String(value).trim()

  return helper.isValid(normalized) ? normalized : undefined
}

function includesAny(value: string | undefined, patterns: string[]) {
  return helper.isValid(value) && patterns.some(pattern => value!.includes(pattern))
}

function parseHostname(value?: string) {
  if (!helper.isValid(value)) {
    return undefined
  }

  try {
    return new URL(String(value)).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return undefined
  }
}

function titleCaseWords(value: string): string {
  return value
    .split(/[^a-z0-9]+/i)
    .filter(helper.isValid)
    .map(token => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(' ')
}

function readUrl(value?: string) {
  if (!helper.isValid(value)) {
    return undefined
  }

  try {
    return new URL(String(value))
  } catch {
    return undefined
  }
}

function getTrafficSourceChannelFromUrl(value?: string): TrafficSourceChannel | undefined {
  const url = readUrl(value)

  if (!url) {
    return undefined
  }

  const utmSource = mapTrafficSourceChannel(url.searchParams.get('utm_source') || undefined)

  if (utmSource) {
    return utmSource
  }

  const utmMedium = mapTrafficSourceChannel(url.searchParams.get('utm_medium') || undefined)

  if (utmMedium) {
    return utmMedium
  }

  if (url.searchParams.has('fbclid')) {
    return 'meta'
  }

  if (url.searchParams.has('gclid') || url.searchParams.has('gbraid') || url.searchParams.has('wbraid')) {
    return 'google'
  }

  if (url.searchParams.has('li_fat_id')) {
    return 'linkedin'
  }

  if (url.searchParams.has('ttclid')) {
    return 'tiktok'
  }

  if (url.searchParams.has('twclid')) {
    return 'x'
  }

  return undefined
}

export function mapTrafficSourceChannel(value?: string): TrafficSourceChannel | undefined {
  const normalized = normalizeText(value)?.toLowerCase()

  if (!normalized || normalized === 'all') {
    return undefined
  }

  if (includesAny(normalized, ['facebook', 'instagram', 'messenger', 'whatsapp', 'meta', 'fb', 'ig'])) {
    return 'meta'
  }

  if (includesAny(normalized, ['google', 'adwords', 'gclid', 'googleads'])) {
    return 'google'
  }

  if (includesAny(normalized, ['linkedin', 'lnkd'])) {
    return 'linkedin'
  }

  if (includesAny(normalized, ['twitter', 't.co', ' x ', 'x.com']) || normalized === 'x') {
    return 'x'
  }

  if (includesAny(normalized, ['youtube', 'youtu.be'])) {
    return 'youtube'
  }

  if (includesAny(normalized, ['tiktok'])) {
    return 'tiktok'
  }

  if (includesAny(normalized, ['email', 'newsletter', 'mail'])) {
    return 'email'
  }

  if (includesAny(normalized, ['direct', '(direct)', 'typed', 'none'])) {
    return 'direct'
  }

  if (normalized in TRAFFIC_SOURCE_LABELS) {
    return normalized as TrafficSourceChannel
  }

  return undefined
}

export function resolveTrafficSourceChannel(source?: TrafficSourceRecord): TrafficSourceChannel {
  const explicitChannel = mapTrafficSourceChannel(source?.channel)

  if (explicitChannel) {
    return explicitChannel
  }

  const utmChannel = mapTrafficSourceChannel(source?.utmSource) || mapTrafficSourceChannel(source?.utmMedium)

  if (utmChannel) {
    return utmChannel
  }

  const landingUrlChannel = getTrafficSourceChannelFromUrl(source?.landingUrl)

  if (landingUrlChannel) {
    return landingUrlChannel
  }

  const referrerHost = parseHostname(source?.referrer)

  if (!helper.isValid(referrerHost)) {
    return 'direct'
  }

  if (
    includesAny(referrerHost, [
      'facebook.com',
      'fb.com',
      'instagram.com',
      'messenger.com',
      'm.me',
      'whatsapp.com'
    ])
  ) {
    return 'meta'
  }

  if (includesAny(referrerHost, ['google.', 'googlesyndication.com'])) {
    return 'google'
  }

  if (includesAny(referrerHost, ['linkedin.com'])) {
    return 'linkedin'
  }

  if (includesAny(referrerHost, ['twitter.com', 'x.com', 't.co'])) {
    return 'x'
  }

  if (includesAny(referrerHost, ['youtube.com', 'youtu.be'])) {
    return 'youtube'
  }

  if (includesAny(referrerHost, ['tiktok.com'])) {
    return 'tiktok'
  }

  if (includesAny(referrerHost, ['mail.', 'outlook.', 'gmail.', 'yahoo.', 'proton.'])) {
    return 'email'
  }

  return 'other'
}

export function resolveTrafficSourceLabel(source?: TrafficSourceRecord): string | undefined {
  return TRAFFIC_SOURCE_LABELS[resolveTrafficSourceChannel(source)]
}

export function normalizeTrafficSourceLabel(value?: string): string | undefined {
  const channel = mapTrafficSourceChannel(value)

  if (channel) {
    return TRAFFIC_SOURCE_LABELS[channel]
  }

  const normalized = normalizeText(value)?.toLowerCase()

  if (!normalized) {
    return undefined
  }

  return titleCaseWords(normalized)
}