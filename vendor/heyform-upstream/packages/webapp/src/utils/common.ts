import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { helper, toURLQuery } from '@heyform-inc/utils'

import { getDeviceId } from './auth'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getSubdomain(domain: string) {
  if (!isValidDomain(domain)) {
    return
  }

  const arr = domain.split('.')

  if (arr.length === 2) {
    return 'www'
  }

  return arr[0]
}

export function getDomainName(domain: string) {
  if (!isValidDomain(domain)) {
    return
  }

  const arr = domain.split('.')

  if (arr.length === 2) {
    return '@'
  }

  return arr[0]
}

export function isRootDomain(domain: string) {
  return isValidDomain(domain) && domain.split('.').length === 2
}

export function isValidDomain(domain: string) {
  if (
    !helper.isValid(domain) ||
    !helper.isFQDN(domain, {
      allow_underscores: true,
      allow_numeric_tld: true,
      allow_wildcard: true
    })
  ) {
    return false
  }

  return domain.split('.').length <= 3
}

export function scrollIntoViewIfNeeded(container: HTMLElement, target: HTMLElement) {
  if (!container || !target) return

  const containerRect = container.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()

  const isInViewport =
    targetRect.top >= containerRect.top && targetRect.bottom <= containerRect.bottom

  if (!isInViewport) {
    const scrollTop = targetRect.top - containerRect.top + container.scrollTop

    container.scrollTo({
      top: scrollTop,
      behavior: 'auto'
    })
  }
}

export function uniqueArray<T>(arr: T[]) {
  return Array.from(new Set(arr))
}

export function getDecoratedURL(url: string, query: Record<string, string>) {
  return toURLQuery(query, url)
}

function isCssImageValue(value: string) {
  const normalizedValue = value.trim().toLowerCase()

  return (
    normalizedValue.startsWith('url(') ||
    normalizedValue.startsWith('linear-gradient(') ||
    normalizedValue.startsWith('radial-gradient(') ||
    normalizedValue.startsWith('conic-gradient(') ||
    normalizedValue.startsWith('repeating-linear-gradient(') ||
    normalizedValue.startsWith('repeating-radial-gradient(') ||
    normalizedValue.startsWith('repeating-conic-gradient(') ||
    normalizedValue.startsWith('image-set(') ||
    normalizedValue.startsWith('var(')
  )
}

export function isRenderableImageSource(value?: string | null) {
  if (!helper.isValid(value)) {
    return false
  }

  const normalizedValue = value.trim()

  if (!normalizedValue || isCssImageValue(normalizedValue)) {
    return false
  }

  return (
    helper.isURL(normalizedValue) ||
    normalizedValue.startsWith('/') ||
    normalizedValue.startsWith('./') ||
    normalizedValue.startsWith('../') ||
    normalizedValue.startsWith('blob:') ||
    normalizedValue.startsWith('data:image/')
  )
}

export function nextTick(callback: () => void, ms = 1_000) {
  setTimeout(callback, ms / 60)
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')

  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()

  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 100)
}

function getDownloadFilename(contentDisposition: string | null, fallbackFilename: string) {
  if (!helper.isValid(contentDisposition)) {
    return fallbackFilename
  }

  const encodedMatch = contentDisposition!.match(/filename\*=UTF-8''([^;]+)/i)

  if (encodedMatch?.[1]) {
    return decodeURIComponent(encodedMatch[1])
  }

  const quotedMatch = contentDisposition!.match(/filename="([^"]+)"/i)

  if (quotedMatch?.[1]) {
    return quotedMatch[1]
  }

  const plainMatch = contentDisposition!.match(/filename=([^;]+)/i)

  return plainMatch?.[1]?.trim() || fallbackFilename
}

async function getDownloadErrorMessage(response: Response) {
  const fallbackMessage = `Download failed with status ${response.status}`
  const text = (await response.text()).trim()

  if (!helper.isValid(text)) {
    return fallbackMessage
  }

  try {
    const payload = JSON.parse(text)

    if (helper.isValid(payload?.message)) {
      return String(payload.message)
    }

    if (Array.isArray(payload?.message) && payload.message.length > 0) {
      return String(payload.message[0])
    }
  } catch {
    return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || fallbackMessage
  }

  return fallbackMessage
}

export function downloadJson(data: any, filename: string) {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })

  triggerBlobDownload(blob, filename.endsWith('.json') ? filename : `${filename}.json`)
}

export async function downloadFile(url: string, fallbackFilename: string) {
  const deviceId = getDeviceId()
  const response = await fetch(url, {
    credentials: 'include',
    headers: deviceId
      ? {
          'X-Device-Id': deviceId
        }
      : undefined
  })

  if (!response.ok) {
    throw new Error(await getDownloadErrorMessage(response))
  }

  const blob = await response.blob()
  const filename = getDownloadFilename(
    response.headers.get('Content-Disposition'),
    fallbackFilename
  )

  triggerBlobDownload(blob, filename)
}
