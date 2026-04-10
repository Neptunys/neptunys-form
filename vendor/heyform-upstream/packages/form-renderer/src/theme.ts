import type { FormTheme } from '@heyform-inc/shared-types-enums'

import { alpha, helper, hexToRgb, isDarkColor } from '@heyform-inc/utils'

type RendererFormTheme = FormTheme & {
  logoSize?: number
  desktopBackgroundImage?: string
  mobileBackgroundImage?: string
  desktopAnswerWidth?: number
  mobileAnswerWidth?: number
  desktopAnswerGap?: number
  mobileAnswerGap?: number
  progressColor?: string
  progressTrackColor?: string
}

export const SYSTEM_FONTS =
  '-apple-system, BlinkMacSystemFont, Helvetica, Roboto, Tahoma, Arial, "PingFang SC", "Hiragino Sans GB", "Heiti SC", STXihei, "Microsoft YaHei", SimHei, "WenQuanYi Micro Hei", serif'

export const GOOGLE_FONTS = [
  'Inter',
  'Public Sans',
  'Montserrat',
  'Alegreya',
  'B612',
  'Muli',
  'Titillium Web',
  'Varela',
  'Vollkorn',
  'IBM Plex Mono',
  'Crimson Text',
  'Cairo',
  'BioRhyme',
  'Karla',
  'Lora',
  'Frank Ruhl Libre',
  'Playfair Display',
  'Archivo',
  'Spectral',
  'Fjalla One',
  'Roboto',
  'Rubik',
  'Source Sans 3',
  'Cardo',
  'Cormorant',
  'Work Sans',
  'Rakkas',
  'Concert One',
  'Yatra One',
  'Arvo',
  'Lato',
  'Abril Fatface',
  'Ubuntu',
  'PT Serif',
  'Old Standard TT',
  'Oswald',
  'Open Sans',
  'Courier Prime',
  'Poppins',
  'Josefin Sans',
  'Fira Sans',
  'Nunito',
  'Exo 2',
  'Merriweather',
  'Noto Sans'
]

const FONT_FAMILY_ALIASES: Record<string, string> = {
  'Source Sans Pro': 'Source Sans 3'
}

export const DEFAULT_THEME: RendererFormTheme = {
  fontFamily: GOOGLE_FONTS[0],
  questionTextColor: '#000',
  answerTextColor: '#0445AF',
  answerBorderRadius: 6,
  logoSize: 40,
  buttonBackground: '#0445AF',
  buttonTextColor: '#fff',
  buttonBorderRadius: 6,
  backgroundColor: '#fff',
  progressColor: '#0445AF',
  progressTrackColor: 'rgba(4, 69, 175, 0.15)'
}

function normalizeBackgroundImages(theme: RendererFormTheme): RendererFormTheme {
  const normalizedTheme = {
    ...theme
  }
  const hasResponsiveBackgrounds =
    helper.isValid(normalizedTheme.desktopBackgroundImage) ||
    helper.isValid(normalizedTheme.mobileBackgroundImage)

  if (!hasResponsiveBackgrounds && helper.isValid(normalizedTheme.backgroundImage)) {
    normalizedTheme.desktopBackgroundImage = normalizedTheme.backgroundImage
    normalizedTheme.mobileBackgroundImage = normalizedTheme.backgroundImage
  }

  normalizedTheme.backgroundImage = undefined

  return normalizedTheme
}

function isGoogleFontsEnabled() {
  if (typeof window === 'undefined') {
    return true
  }

  const value = (window as any).heyform?.enableGoogleFonts

  return value === undefined ? true : helper.isTrue(value)
}

export function getWebFontURL(name?: string | string[]) {
  if (!isGoogleFontsEnabled()) {
    return ''
  }

  const fontNames = ((helper.isArray(name) ? name : [name]) as string[])
    .map(row => (row ? FONT_FAMILY_ALIASES[row] || row : row))
    .filter(row => row && GOOGLE_FONTS.includes(row))

  if (helper.isEmpty(fontNames)) {
    fontNames.push(DEFAULT_THEME.fontFamily!)
  }

  const families = fontNames.map(
    name => `family=${name.replace(/\s+/g, '+')}:wght@400;500;600;700;800`
  )

  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`
}

export function insertWebFont(name?: string | string[], id = 'heyform-webfont') {
  const href = getWebFontURL(name)

  if (!href) {
    return
  }

  let link = document.getElementById(id)

  if (!link) {
    link = document.createElement('link')

    link.id = id
    link.setAttribute('rel', 'stylesheet')

    document.head.appendChild(link)
  }

  link.setAttribute('href', href)
}

export function getTheme(theme?: FormTheme): FormTheme {
  const newTheme = normalizeBackgroundImages({
    ...DEFAULT_THEME,
    ...theme
  })

  if (newTheme.fontFamily) {
    newTheme.fontFamily = FONT_FAMILY_ALIASES[newTheme.fontFamily] || newTheme.fontFamily
  }

  if (!newTheme.fontFamily || !GOOGLE_FONTS.includes(newTheme.fontFamily)) {
    newTheme.fontFamily = DEFAULT_THEME.fontFamily
  }

  return newTheme
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

function isImageSource(value?: string) {
  if (!value) {
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

function escapeCssUrl(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function getAdaptedColor(color: string, alphaNum = 0.5, step = 20): string {
  const isDark = isDarkColor(color)
  const [red, green, blue] = hexToRgb(color).map(c =>
    isDark ? Math.min(255, c + step) : Math.max(0, c - step)
  )
  return `rgba(${red}, ${green}, ${blue}, ${alphaNum})`
}

export function getThemeStyle(theme: RendererFormTheme, query?: Record<string, any>): string {
  const normalizedTheme = normalizeBackgroundImages({ ...theme })

  if (helper.isTrue(query?.transparentBackground)) {
    normalizedTheme.backgroundColor = 'transparent'
    normalizedTheme.backgroundImage = undefined
    normalizedTheme.desktopBackgroundImage = undefined
    normalizedTheme.mobileBackgroundImage = undefined
  }

  const desktopBackgroundImage = normalizedTheme.desktopBackgroundImage
  const mobileBackgroundImage = normalizedTheme.mobileBackgroundImage
  const progressColor = normalizedTheme.progressColor || normalizedTheme.buttonBackground
  const progressTrackColor =
    normalizedTheme.progressTrackColor ||
    alpha(progressColor || normalizedTheme.buttonBackground!, 0.18)

  const backgroundImageRule = (value?: string) => {
    if (!value) {
      return ''
    }

    const normalizedValue = value.trim()

    return isImageSource(normalizedValue)
      ? `background-image: url("${escapeCssUrl(normalizedValue)}");`
      : `background-image: ${normalizedValue};`
  }

  return `
  html {
    --heyform-font-family: ${normalizedTheme.fontFamily};
    --heyform-question-color: ${normalizedTheme.questionTextColor};
    --heyform-description-color: ${alpha(normalizedTheme.questionTextColor!, 0.8)};
    --heyform-label-color: ${alpha(normalizedTheme.questionTextColor!, 0.5)};
    --heyform-answer-color: ${normalizedTheme.answerTextColor};
    --heyform-answer-opacity-80-color: ${alpha(normalizedTheme.answerTextColor!, 0.8)};
    --heyform-answer-opacity-60-color: ${alpha(normalizedTheme.answerTextColor!, 0.6)};
    --heyform-answer-opacity-30-color: ${alpha(normalizedTheme.answerTextColor!, 0.3)};
    --heyform-answer-opacity-10-color: ${alpha(normalizedTheme.answerTextColor!, 0.1)};
    --heyform-answer-radius: ${normalizedTheme.answerBorderRadius}px;
    --heyform-answer-width-desktop: ${helper.isNumber(normalizedTheme.desktopAnswerWidth) ? `${normalizedTheme.desktopAnswerWidth}px` : '31rem'};
    --heyform-answer-width-mobile: ${helper.isNumber(normalizedTheme.mobileAnswerWidth) ? `${normalizedTheme.mobileAnswerWidth}px` : '100%'};
    --heyform-answer-gap-desktop: ${helper.isNumber(normalizedTheme.desktopAnswerGap) ? `${normalizedTheme.desktopAnswerGap}px` : '0.75rem'};
    --heyform-answer-gap-mobile: ${helper.isNumber(normalizedTheme.mobileAnswerGap) ? `${normalizedTheme.mobileAnswerGap}px` : '0.625rem'};
    --heyform-logo-size: ${normalizedTheme.logoSize}px;
    --heyform-button-color: ${normalizedTheme.buttonBackground};
    --heyform-button-opacity-80-color: ${alpha(normalizedTheme.buttonBackground!, 0.8)};
    --heyform-button-text-color: ${normalizedTheme.buttonTextColor};
    --heyform-button-text-opacity-20-color: ${alpha(normalizedTheme.buttonTextColor!, 0.2)};
    --heyform-button-radius: ${normalizedTheme.buttonBorderRadius}px;
    --heyform-background-color: ${normalizedTheme.backgroundColor};
    --heyform-group-background-color: ${getAdaptedColor(normalizedTheme.backgroundColor!)};
    --heyform-progress-color: ${progressColor};
    --heyform-progress-track-color: ${progressTrackColor};
  }
  
  .heyform-theme-background {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 2;
    background-size: cover;
    background-position: center;
    pointer-events: none;
    background-color: var(--heyform-background-color);
    ${backgroundImageRule(desktopBackgroundImage)}
  }

  @media (max-width: 800px) {
    .heyform-theme-background {
      ${backgroundImageRule(mobileBackgroundImage)}
    }
  }

  .heyform-block-group {
    pointer-events: none;
    position: absolute;
    top: 0px;
    left: 0px;
    width: 100%;
    padding-left: 5rem;
    padding-right: 5rem;
    background: var(--heyform-group-background-color);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    backdrop-filter: saturate(180%) blur(20px);
    z-index: 12;
  }
  
  @media (max-width: 800px) {
    .heyform-block-group {
      padding-left: 1.5rem;
      padding-right: 1.5rem;
    }
  
    .heyform-theme-background,
    .heyform-block-group {
      position: fixed;
    }
  }

  ${
    helper.isValid(normalizedTheme.backgroundBrightness)
      ? `
    .heyform-theme-background:before {
      pointer-events: none;
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      content: "";
      z-index: 2;
      opacity: ${Math.abs(normalizedTheme.backgroundBrightness! / 100)};
      background: ${normalizedTheme.backgroundBrightness! > 0 ? '#fff' : '#000'};
    }`
      : ''
  }
  `
}

export function getStripeElementStyle(theme: FormTheme) {
  return {
    base: {
      color: theme.answerTextColor,
      fontFamily: [theme.fontFamily, SYSTEM_FONTS].filter(Boolean).join(','),
      fontSize: '24px',
      fontSmoothing: 'antialiased',
      '::placeholder': {
        color: alpha(theme.answerTextColor!, 0.3)
      }
    },
    invalid: {
      color: '#dc2626'
    }
  }
}
