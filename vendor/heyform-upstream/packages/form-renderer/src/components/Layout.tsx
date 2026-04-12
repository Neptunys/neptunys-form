import { FieldLayoutAlignEnum, type Layout as FormLayout } from '@heyform-inc/shared-types-enums'
import type { CSSProperties, FC } from 'react'
import { memo } from 'react'

import { isRenderableImageSource } from '../utils'
import { deepEqual, helper } from '@heyform-inc/utils'

function filterStyle(brightness?: number) {
  if (!brightness) {
    return undefined
  }

  const value = 1 + brightness / 100

  if (value < 0) {
    return {
      filter: `brightness(${value})`
    }
  }

  return {
    filter: `contrast(${2 - value}) brightness(${value})`
  }
}

const LayoutComponent: FC<FormLayout> = props => {
  if (helper.isEmpty(props) || !isRenderableImageSource(props!.mediaUrl)) {
    return null
  }

  const style: CSSProperties | undefined =
    props.align === FieldLayoutAlignEnum.INLINE
      ? {
          width: `${helper.isNumber(props.inlineMediaWidth) ? Math.max(20, Math.min(100, props.inlineMediaWidth)) : 75}%`,
          maxWidth: '100%'
        }
      : undefined

  return (
    <div className={`heyform-layout heyform-layout-${props!.align}`} style={style}>
      <img
        src={props!.mediaUrl}
        style={filterStyle(props!.brightness)}
        alt="NeptunysForm layout image"
      />
    </div>
  )
}

export const Layout = memo(LayoutComponent, deepEqual)
