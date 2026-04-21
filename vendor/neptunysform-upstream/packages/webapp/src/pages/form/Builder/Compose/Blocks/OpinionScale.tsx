import type { CSSProperties, FC } from 'react'
import { useMemo } from 'react'

import { FakeRadio } from '../FakeRadio'
import type { BlockProps } from './Block'
import { Block } from './Block'

function getOpinionScaleStyle(optionSize?: number): CSSProperties | undefined {
  if (typeof optionSize !== 'number' || Number.isNaN(optionSize)) {
    return undefined
  }

  const desktopSize = Math.max(24, Math.min(96, Math.round(optionSize)))
  const mobileSize = Math.max(24, Math.round(desktopSize * 0.9))

  return {
    ['--neptunysform-opinion-option-size' as string]: `${desktopSize}px`,
    ['--neptunysform-opinion-option-size-mobile' as string]: `${mobileSize}px`
  }
}

export const OpinionScale: FC<BlockProps> = ({ field, locale, ...restProps }) => {
  const indexes = useMemo(() => {
    return Array.from({ length: field.properties?.total || 10 }).map((_, index) => index + 1)
  }, [field.properties?.total])
  const isCentered = field.properties?.optionAlignment === 'center'
  const style = getOpinionScaleStyle(field.properties?.optionSize)

  return (
    <Block
      className={`neptunysform-opinion-scale${isCentered ? ' neptunysform-options-center' : ''}`}
      field={field}
      locale={locale}
      style={style}
      {...restProps}
    >
      <div className="neptunysform-radio-group">
        {indexes.map(index => (
          <FakeRadio label={index} key={index} />
        ))}
      </div>
      <div className="neptunysform-opinion-scale-labels">
        <div className="flex-1 text-left">{field.properties?.leftLabel}</div>
        <div className="flex-1 text-center">{field.properties?.centerLabel}</div>
        <div className="flex-1 text-right">{field.properties?.rightLabel}</div>
      </div>
    </Block>
  )
}
