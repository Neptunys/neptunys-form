import type { FC } from 'react'
import clsx from 'clsx'

import type { BlockProps } from './Block'
import { Block } from './Block'

export const ThankYou: FC<BlockProps> = ({ field, locale, ...restProps }) => {
  return (
    <Block
      className={clsx(
        'neptunysform-thank-you neptunysform-empty-state',
        field.layout?.contentAlign && `neptunysform-welcome-align-${field.layout.contentAlign}`,
        field.layout?.titleSize && field.layout.titleSize !== 'normal' && `neptunysform-welcome-title-${field.layout.titleSize}`,
        typeof field.layout?.titleSizePx === 'number' && 'neptunysform-welcome-title-custom'
      )}
      field={field}
      locale={locale}
      style={{
        '--neptunysform-welcome-title-size-px':
          typeof field.layout?.titleSizePx === 'number' ? `${field.layout.titleSizePx}px` : undefined
      }}
      {...restProps}
    />
  )
}
