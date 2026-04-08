export function createId(prefix: string) {
  const random = Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now()}-${random}`
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function average(values: number[]) {
  if (!values.length) {
    return 0
  }

  return values.reduce((total, current) => total + current, 0) / values.length
}

export function toPercentage(value: number) {
  return `${Math.round(value * 100)}%`
}

export function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function csvEscape(value: unknown) {
  const stringValue = String(value ?? '')
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`
  }

  return stringValue
}

let measurementElement: HTMLSpanElement | null = null

function getMeasurementElement() {
  if (typeof document === 'undefined') {
    return null
  }

  if (measurementElement) {
    return measurementElement
  }

  measurementElement = document.createElement('span')
  measurementElement.setAttribute('aria-hidden', 'true')
  measurementElement.style.position = 'fixed'
  measurementElement.style.left = '-9999px'
  measurementElement.style.top = '-9999px'
  measurementElement.style.visibility = 'hidden'
  measurementElement.style.pointerEvents = 'none'
  measurementElement.style.whiteSpace = 'pre'
  measurementElement.style.padding = '0'
  measurementElement.style.margin = '0'
  measurementElement.style.border = '0'
  document.body.appendChild(measurementElement)
  return measurementElement
}

export function measureTextWidth(
  text: string,
  options?: {
    fontFamily?: string
    fontSizePx?: number
    fontWeight?: number | string
  },
) {
  const fallbackText = text || ' '
  const element = getMeasurementElement()

  if (!element) {
    return fallbackText.length * ((options?.fontSizePx ?? 16) * 0.58)
  }

  element.style.fontFamily = options?.fontFamily ?? 'sans-serif'
  element.style.fontSize = `${options?.fontSizePx ?? 16}px`
  element.style.fontWeight = String(options?.fontWeight ?? 400)
  element.textContent = fallbackText
  return element.getBoundingClientRect().width
}

export function measureSharedControlWidth(
  labels: string[],
  options?: {
    fontFamily?: string
    fontSizePx?: number
    fontWeight?: number | string
    minWidth?: number
    horizontalPadding?: number
    extraWidth?: number
  },
) {
  const longestContentWidth = labels.reduce((maxWidth, label) => {
    return Math.max(maxWidth, measureTextWidth(label.trim(), options))
  }, 0)

  return Math.ceil(Math.max(
    options?.minWidth ?? 0,
    longestContentWidth + ((options?.horizontalPadding ?? 0) * 2) + (options?.extraWidth ?? 0),
  ))
}
