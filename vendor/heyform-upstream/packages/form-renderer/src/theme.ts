import type { FormTheme } from '@heyform-inc/shared-types-enums'

import { alpha, helper, hexToRgb, isDarkColor, isHexColor } from '@heyform-inc/utils'

type RendererFormTheme = FormTheme & {
  logoSize?: number
  titleFontSize?: 'small' | 'normal' | 'large'
  titleFontSizePx?: number
  mobileTitleFontSizePx?: number
  screenFontSize?: 'small' | 'normal' | 'large'
  descriptionFontSizePx?: number
  mobileDescriptionFontSizePx?: number
  fieldFontSize?: 'small' | 'normal' | 'large'
  answerFontSizePx?: number
  mobileAnswerFontSizePx?: number
  answerKeyBackground?: string
  answerKeyActiveColor?: string
  answerKeyActiveBackground?: string
  showChoiceCheckIcon?: boolean
  desktopBackgroundImage?: string
  mobileBackgroundImage?: string
  desktopBackgroundBrightness?: number
  mobileBackgroundBrightness?: number
  desktopContentWidth?: number
  mobileContentWidth?: number
  desktopAnswerWidth?: number
  mobileAnswerWidth?: number
  desktopAnswerGap?: number
  mobileAnswerGap?: number
  desktopContentOffset?: number
  progressColor?: string
  progressTrackColor?: string
  topProgressColor?: string
  topProgressTrackColor?: string
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
  screenFontSize: 'normal',
  fieldFontSize: 'normal',
  questionTextColor: '#000',
  answerTextColor: '#0445AF',
  answerKeyBackground: '#fff',
  answerKeyActiveColor: '#fff',
  answerKeyActiveBackground: '#0445AF',
  showChoiceCheckIcon: true,
  answerBorderRadius: 6,
  logoSize: 40,
  buttonBackground: '#0445AF',
  buttonTextColor: '#fff',
  buttonBorderRadius: 6,
  backgroundColor: '#fff',
  progressColor: '#0445AF',
  progressTrackColor: 'rgba(4, 69, 175, 0.15)',
  topProgressColor: '#0445AF',
  topProgressTrackColor: 'rgba(4, 69, 175, 0.12)'
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

function getBackgroundBrightnessValue(
  theme: RendererFormTheme,
  platform: 'desktop' | 'mobile'
): number {
  const platformValue =
    platform === 'desktop' ? theme.desktopBackgroundBrightness : theme.mobileBackgroundBrightness

  if (typeof platformValue === 'number') {
    return platformValue
  }

  return typeof theme.backgroundBrightness === 'number' ? theme.backgroundBrightness : 0
}

function getBackgroundOverlayRule(brightness: number): string {
  return `
      opacity: ${Math.abs(brightness / 100)};
      background: ${brightness > 0 ? '#fff' : '#000'};
  `
}

function getComputedLineHeight(fontSize: number, multiplier: number, minOffset: number) {
  return `${Math.max(fontSize + minOffset, Math.round(fontSize * multiplier))}px`
}

function getTitleFontScale(
  size?: 'small' | 'normal' | 'large',
  overridePx?: number
) {
  if (typeof overridePx === 'number') {
    return {
      titleSize: `${overridePx}px`,
      titleLineHeight: getComputedLineHeight(overridePx, 1.15, 4)
    }
  }

  switch (size) {
    case 'small':
      return {
        titleSize: '1.625rem',
        titleLineHeight: '2rem'
      }
    case 'large':
      return {
        titleSize: '2.25rem',
        titleLineHeight: '2.5rem'
      }
    default:
      return {
        titleSize: '1.875rem',
        titleLineHeight: '2.25rem'
      }
  }
}

function getDescriptionFontScale(
  size?: 'small' | 'normal' | 'large',
  overridePx?: number
) {
  if (typeof overridePx === 'number') {
    return {
      descriptionSize: `${overridePx}px`,
      descriptionLineHeight: getComputedLineHeight(overridePx, 1.55, 6)
    }
  }

  switch (size) {
    case 'small':
      return {
        descriptionSize: '1rem',
        descriptionLineHeight: '1.5rem'
      }
    case 'large':
      return {
        descriptionSize: '1.25rem',
        descriptionLineHeight: '1.875rem'
      }
    default:
      return {
        descriptionSize: '1.125rem',
        descriptionLineHeight: '1.75rem'
      }
  }
}

function getFieldFontScale(
  size?: 'small' | 'normal' | 'large',
  overridePx?: number
) {
  if (typeof overridePx === 'number') {
    const inputSize = Math.max(overridePx + 4, Math.round(overridePx * 1.33))

    return {
      answerSize: `${overridePx}px`,
      answerLineHeight: getComputedLineHeight(overridePx, 1.3, 4),
      inputSize: `${inputSize}px`,
      inputLineHeight: getComputedLineHeight(inputSize, 1.35, 6)
    }
  }

  switch (size) {
    case 'small':
      return {
        answerSize: '1rem',
        answerLineHeight: '1.375rem',
        inputSize: '1.25rem',
        inputLineHeight: '1.75rem'
      }
    case 'large':
      return {
        answerSize: '1.25rem',
        answerLineHeight: '1.625rem',
        inputSize: '1.75rem',
        inputLineHeight: '2.25rem'
      }
    default:
      return {
        answerSize: '1.125rem',
        answerLineHeight: '1.375rem',
        inputSize: '1.5rem',
        inputLineHeight: '2rem'
      }
  }
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
  const rootColorScheme = isHexColor(normalizedTheme.backgroundColor || '')
    ? isDarkColor(normalizedTheme.backgroundColor!)
      ? 'dark'
      : 'light'
    : isHexColor(normalizedTheme.questionTextColor || '')
      ? isDarkColor(normalizedTheme.questionTextColor!)
        ? 'light'
        : 'dark'
      : 'light'
  const desktopBackgroundBrightness = getBackgroundBrightnessValue(normalizedTheme, 'desktop')
  const mobileBackgroundBrightness = getBackgroundBrightnessValue(normalizedTheme, 'mobile')
  const progressColor = normalizedTheme.progressColor || normalizedTheme.buttonBackground
  const progressTrackColor =
    normalizedTheme.progressTrackColor ||
    alpha(progressColor || normalizedTheme.buttonBackground!, 0.18)
  const topProgressColor =
    normalizedTheme.topProgressColor || progressColor || normalizedTheme.buttonBackground
  const topProgressTrackColor =
    normalizedTheme.topProgressTrackColor || alpha(topProgressColor || progressColor!, 0.18)
  const answerKeyBackground = normalizedTheme.answerKeyBackground || normalizedTheme.backgroundColor
  const answerKeyActiveColor =
    normalizedTheme.answerKeyActiveColor || normalizedTheme.backgroundColor
  const answerKeyActiveBackground =
    normalizedTheme.answerKeyActiveBackground || alpha(normalizedTheme.answerTextColor!, 0.8)
  const desktopBackButtonBackground =
    normalizedTheme.desktopBackButtonBackground || normalizedTheme.buttonBackground
  const consentTextColor = normalizedTheme.consentTextColor || normalizedTheme.answerTextColor
  const consentLinkColor = normalizedTheme.consentLinkColor || normalizedTheme.buttonBackground
  const consentCheckboxColor = normalizedTheme.consentCheckboxColor || normalizedTheme.buttonBackground
  const answerSelectionIndicatorDisplay = helper.isFalse(normalizedTheme.showChoiceCheckIcon)
    ? 'none'
    : 'block'
  const answerSelectionIndicatorOpacity = helper.isFalse(normalizedTheme.showChoiceCheckIcon)
    ? '0'
    : '1'
  const answerSelectionPaddingMobile = helper.isFalse(normalizedTheme.showChoiceCheckIcon)
    ? '0.9rem'
    : '2.6rem'
  const titleFontScale = getTitleFontScale(
    normalizedTheme.titleFontSize || normalizedTheme.screenFontSize,
    normalizedTheme.titleFontSizePx
  )
  const mobileTitleFontScale = getTitleFontScale(
    normalizedTheme.titleFontSize || normalizedTheme.screenFontSize,
    helper.isNumber(normalizedTheme.mobileTitleFontSizePx)
      ? normalizedTheme.mobileTitleFontSizePx
      : normalizedTheme.titleFontSizePx
  )
  const descriptionFontScale = getDescriptionFontScale(
    normalizedTheme.screenFontSize,
    normalizedTheme.descriptionFontSizePx
  )
  const mobileDescriptionFontScale = getDescriptionFontScale(
    normalizedTheme.screenFontSize,
    helper.isNumber(normalizedTheme.mobileDescriptionFontSizePx)
      ? normalizedTheme.mobileDescriptionFontSizePx
      : normalizedTheme.descriptionFontSizePx
  )
  const fieldFontScale = getFieldFontScale(
    normalizedTheme.fieldFontSize,
    normalizedTheme.answerFontSizePx
  )
  const mobileFieldFontScale = getFieldFontScale(
    normalizedTheme.fieldFontSize,
    helper.isNumber(normalizedTheme.mobileAnswerFontSizePx)
      ? normalizedTheme.mobileAnswerFontSizePx
      : normalizedTheme.answerFontSizePx
  )

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
  html, body, .heyform-render-root, .heyform-root {
    background-color: ${normalizedTheme.backgroundColor};
    color-scheme: ${rootColorScheme};
  }

  html, .heyform-root {
    --heyform-font-family: ${normalizedTheme.fontFamily};
    --heyform-question-color: ${normalizedTheme.questionTextColor};
    --heyform-description-color: ${alpha(normalizedTheme.questionTextColor!, 0.8)};
    --heyform-label-color: ${alpha(normalizedTheme.questionTextColor!, 0.5)};
    --heyform-answer-color: ${normalizedTheme.answerTextColor};
    --heyform-answer-opacity-80-color: ${alpha(normalizedTheme.answerTextColor!, 0.8)};
    --heyform-answer-opacity-60-color: ${alpha(normalizedTheme.answerTextColor!, 0.6)};
    --heyform-answer-opacity-30-color: ${alpha(normalizedTheme.answerTextColor!, 0.3)};
    --heyform-answer-opacity-10-color: ${alpha(normalizedTheme.answerTextColor!, 0.1)};
    --heyform-answer-key-background: ${answerKeyBackground};
    --heyform-answer-key-active-color: ${answerKeyActiveColor};
    --heyform-answer-key-active-background: ${answerKeyActiveBackground};
    --heyform-answer-selection-indicator-display: ${answerSelectionIndicatorDisplay};
    --heyform-answer-selection-indicator-opacity: ${answerSelectionIndicatorOpacity};
    --heyform-answer-selection-padding-right-mobile: ${answerSelectionPaddingMobile};
    --heyform-content-width-desktop: ${helper.isNumber(normalizedTheme.desktopContentWidth) ? `${normalizedTheme.desktopContentWidth}px` : '52rem'};
    --heyform-content-width-mobile: 100%;
    --heyform-answer-radius: ${normalizedTheme.answerBorderRadius}px;
    --heyform-answer-width-desktop: ${helper.isNumber(normalizedTheme.desktopAnswerWidth) ? `${normalizedTheme.desktopAnswerWidth}px` : '27rem'};
    --heyform-answer-width-mobile: ${helper.isNumber(normalizedTheme.mobileAnswerWidth) ? `${normalizedTheme.mobileAnswerWidth}px` : '100%'};
    --heyform-answer-gap-desktop: ${helper.isNumber(normalizedTheme.desktopAnswerGap) ? `${normalizedTheme.desktopAnswerGap}px` : '0.5rem'};
    --heyform-answer-gap-mobile: ${helper.isNumber(normalizedTheme.mobileAnswerGap) ? `${normalizedTheme.mobileAnswerGap}px` : '0.5rem'};
    --heyform-content-offset-desktop: ${helper.isNumber(normalizedTheme.desktopContentOffset) ? `${normalizedTheme.desktopContentOffset}px` : '0px'};
    --heyform-logo-size: ${normalizedTheme.logoSize}px;
    --heyform-screen-title-size: ${titleFontScale.titleSize};
    --heyform-screen-title-line-height: ${titleFontScale.titleLineHeight};
    --heyform-screen-title-size-mobile: ${mobileTitleFontScale.titleSize};
    --heyform-screen-title-line-height-mobile: ${mobileTitleFontScale.titleLineHeight};
    --heyform-screen-description-size: ${descriptionFontScale.descriptionSize};
    --heyform-screen-description-line-height: ${descriptionFontScale.descriptionLineHeight};
    --heyform-screen-description-size-mobile: ${mobileDescriptionFontScale.descriptionSize};
    --heyform-screen-description-line-height-mobile: ${mobileDescriptionFontScale.descriptionLineHeight};
    --heyform-field-text-size: ${fieldFontScale.answerSize};
    --heyform-field-text-line-height: ${fieldFontScale.answerLineHeight};
    --heyform-field-text-size-mobile: ${mobileFieldFontScale.answerSize};
    --heyform-field-text-line-height-mobile: ${mobileFieldFontScale.answerLineHeight};
    --heyform-input-text-size: ${fieldFontScale.inputSize};
    --heyform-input-text-line-height: ${fieldFontScale.inputLineHeight};
    --heyform-input-text-size-mobile: ${mobileFieldFontScale.inputSize};
    --heyform-input-text-line-height-mobile: ${mobileFieldFontScale.inputLineHeight};
    --heyform-button-color: ${normalizedTheme.buttonBackground};
    --heyform-button-opacity-80-color: ${alpha(normalizedTheme.buttonBackground!, 0.8)};
    --heyform-button-text-color: ${normalizedTheme.buttonTextColor};
    --heyform-desktop-back-button-color: ${desktopBackButtonBackground};
    --heyform-desktop-back-button-opacity-80-color: ${alpha(desktopBackButtonBackground!, 0.8)};
    --heyform-button-text-opacity-20-color: ${alpha(normalizedTheme.buttonTextColor!, 0.2)};
    --heyform-button-radius: ${normalizedTheme.buttonBorderRadius}px;
    --heyform-background-color: ${normalizedTheme.backgroundColor};
    --heyform-group-background-color: ${getAdaptedColor(normalizedTheme.backgroundColor!)};
    --heyform-progress-color: ${progressColor};
    --heyform-progress-track-color: ${progressTrackColor};
    --heyform-top-progress-color: ${topProgressColor};
    --heyform-top-progress-track-color: ${topProgressTrackColor};
    --heyform-consent-text-color: ${consentTextColor};
    --heyform-consent-link-color: ${consentLinkColor};
    --heyform-consent-checkbox-color: ${consentCheckboxColor};
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

  .heyform-theme-background::before {
    pointer-events: none;
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    content: "";
    z-index: 2;
    ${getBackgroundOverlayRule(desktopBackgroundBrightness)}
  }

  @media (max-width: 800px) {
    html, .heyform-root {
      --heyform-screen-title-size: var(--heyform-screen-title-size-mobile);
      --heyform-screen-title-line-height: var(--heyform-screen-title-line-height-mobile);
      --heyform-screen-description-size: var(--heyform-screen-description-size-mobile);
      --heyform-screen-description-line-height: var(--heyform-screen-description-line-height-mobile);
      --heyform-field-text-size: var(--heyform-field-text-size-mobile);
      --heyform-field-text-line-height: var(--heyform-field-text-line-height-mobile);
      --heyform-input-text-size: var(--heyform-input-text-size-mobile);
      --heyform-input-text-line-height: var(--heyform-input-text-line-height-mobile);
    }

    .heyform-theme-background {
      ${backgroundImageRule(mobileBackgroundImage)}
    }

    .heyform-theme-background::before {
      ${getBackgroundOverlayRule(mobileBackgroundBrightness)}
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
