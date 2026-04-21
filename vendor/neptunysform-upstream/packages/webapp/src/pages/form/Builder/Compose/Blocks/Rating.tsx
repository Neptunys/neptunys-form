import { RATING_SHAPE_ICONS, Rate } from '@neptunysform-inc/form-renderer'
import type { CSSProperties, FC } from 'react'

import type { BlockProps } from './Block'
import { Block } from './Block'

function getRatingStyle(optionSize?: number): CSSProperties | undefined {
  if (typeof optionSize !== 'number' || Number.isNaN(optionSize)) {
    return undefined
  }

  const desktopSize = Math.max(24, Math.min(96, Math.round(optionSize)))
  const mobileSize = Math.max(24, Math.round(desktopSize * 0.86))

  return {
    ['--neptunysform-rating-icon-size' as string]: `${desktopSize}px`,
    ['--neptunysform-rating-icon-size-mobile' as string]: `${mobileSize}px`
  }
}

export const Rating: FC<BlockProps> = ({ field, locale, ...restProps }) => {
  const isCentered = field.properties?.optionAlignment === 'center'
  const style = getRatingStyle(field.properties?.optionSize)

  function characterRender(index: number) {
    const Shape = RATING_SHAPE_ICONS[field.properties?.shape || 'star']

    return (
      <>
        {Shape}
        <span className="neptunysform-rate-index">{index}</span>
      </>
    )
  }

  return (
    <Block
      className={`neptunysform-rating${isCentered ? ' neptunysform-options-center' : ''}`}
      field={field}
      locale={locale}
      style={style}
      {...restProps}
    >
      <Rate count={field.properties?.total || 5} itemRender={characterRender} />
    </Block>
  )
}
