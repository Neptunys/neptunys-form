import { helper } from '@neptunysform-inc/utils'

import { getDecoratedURL } from './common'

export type TrafficSourcePreset = {
  value: string
  label: string
  utmSource?: string
  utmMedium?: string
}

export const TRAFFIC_SOURCE_PRESETS: TrafficSourcePreset[] = [
  {
    value: 'direct',
    label: 'Direct link',
    utmSource: 'direct',
    utmMedium: 'direct'
  },
  {
    value: 'meta',
    label: 'Meta ads',
    utmSource: 'meta',
    utmMedium: 'paid_social'
  },
  {
    value: 'google',
    label: 'Google ads',
    utmSource: 'google',
    utmMedium: 'cpc'
  },
  {
    value: 'email',
    label: 'Email campaign',
    utmSource: 'email',
    utmMedium: 'newsletter'
  },
  {
    value: 'linkedin',
    label: 'LinkedIn',
    utmSource: 'linkedin',
    utmMedium: 'paid_social'
  },
  {
    value: 'tiktok',
    label: 'TikTok',
    utmSource: 'tiktok',
    utmMedium: 'paid_social'
  },
  {
    value: 'x',
    label: 'X / Twitter',
    utmSource: 'x',
    utmMedium: 'social'
  },
  {
    value: 'landing_page',
    label: 'Landing page embed',
    utmSource: 'direct',
    utmMedium: 'landing_page'
  }
]

export function buildTrackedShareUrl(
  baseUrl: string,
  sourcePreset: TrafficSourcePreset | undefined,
  campaign: string
) {
  if (!sourcePreset) {
    return baseUrl
  }

  const query: Record<string, string> = {}

  if (helper.isValid(sourcePreset.utmSource)) {
    query.utm_source = sourcePreset.utmSource!
  }

  if (helper.isValid(sourcePreset.utmMedium)) {
    query.utm_medium = sourcePreset.utmMedium!
  }

  if (helper.isValid(campaign)) {
    query.utm_campaign = campaign.trim()
  }

  if (!Object.keys(query).length) {
    return baseUrl
  }

  return getDecoratedURL(baseUrl, query)
}