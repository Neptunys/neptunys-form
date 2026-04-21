import { getTheme, getThemeStyle } from '@neptunysform-inc/form-renderer/src'
import { FormTheme } from '@neptunysform-inc/shared-types-enums'

export function insertThemeStyle(customTheme?: FormTheme) {
  const theme = getTheme(customTheme)
  let content = getThemeStyle(theme)

  let style = document.getElementById('neptunysform-theme')

  if (!style) {
    style = document.createElement('style')
    style.id = 'neptunysform-theme'

    document.head.appendChild(style)
  }

  if (customTheme?.customCSS) {
    content += customTheme!.customCSS
  }

  style.innerHTML = content
}
