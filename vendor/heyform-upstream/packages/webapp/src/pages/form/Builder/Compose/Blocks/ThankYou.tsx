import type { FC } from 'react'
import clsx from 'clsx'

import type { BlockProps } from './Block'
import { Block } from './Block'

export const ThankYou: FC<BlockProps> = ({ field, locale, ...restProps }) => {
  return (
    <Block
      className={clsx(
        'heyform-thank-you heyform-empty-state',
        field.layout?.contentAlign && `heyform-welcome-align-${field.layout.contentAlign}`,
        field.layout?.titleSize && field.layout.titleSize !== 'normal' && `heyform-welcome-title-${field.layout.titleSize}`,
        typeof field.layout?.titleSizePx === 'number' && 'heyform-welcome-title-custom'
      )}
      field={field}
      locale={locale}
      style={{
        '--heyform-welcome-title-size-px':
          typeof field.layout?.titleSizePx === 'number' ? `${field.layout.titleSizePx}px` : undefined
      }}
      {...restProps}
    />
  )
}
