import { IconCheck, IconPhoto } from '@tabler/icons-react'
import clsx from 'clsx'
import type { FC, ReactNode } from 'react'

import { isRenderableImageSource, useKey } from '../utils'

import { IComponentProps } from '../typings'

export interface RadioOption {
  keyName?: string
  label: string
  value: any
  icon?: ReactNode
  image?: string
  enableImage?: boolean
  disabled?: boolean
}

interface RadioProps extends RadioOption, Omit<IComponentProps, 'onClick'> {
  isChecked?: boolean
  isHotkeyShow?: boolean
  autoAdvanceFeedback?: boolean
  onClick?: (value: any) => void
}

export const Radio: FC<RadioProps> = ({
  className,
  keyName,
  image,
  label,
  value,
  icon,
  enableImage,
  isHotkeyShow,
  disabled,
  isChecked,
  autoAdvanceFeedback,
  onClick,
  ...restProps
}) => {
  function handleClick() {
    if (!disabled) {
      onClick?.(value)
    }
  }

  useKey(keyName?.toLowerCase() as string, handleClick)

  return (
    <div
      className={clsx(
        'neptunysform-radio',
        {
          'neptunysform-radio-selected': isChecked,
          'neptunysform-radio-auto-advance-feedback': autoAdvanceFeedback
        },
        className
      )}
      onClick={handleClick}
      {...restProps}
    >
      <div className="neptunysform-radio-container">
        {enableImage && (
          <div className="neptunysform-radio-image">
            {isRenderableImageSource(image) ? (
              <img src={image} alt={label} />
            ) : icon ? (
              icon
            ) : (
              <IconPhoto className="neptunysform-radio-placeholder" />
            )}
          </div>
        )}
        <div className="neptunysform-radio-content">
          {keyName && isHotkeyShow && <div className="neptunysform-radio-hotkey">{keyName}</div>}
          <div className="neptunysform-radio-label">{label}</div>
        </div>
        <div className="neptunysform-radio-icon">
          <IconCheck />
        </div>
      </div>
    </div>
  )
}
