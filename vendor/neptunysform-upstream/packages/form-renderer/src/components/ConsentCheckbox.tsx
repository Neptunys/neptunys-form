import { IconCheck } from '@tabler/icons-react'
import clsx from 'clsx'
import type { FC } from 'react'
import { useCallback } from 'react'

import { stopEvent } from '../utils'

import { IComponentProps } from '../typings'

interface ConsentCheckboxProps extends Omit<IComponentProps<HTMLButtonElement>, 'onChange'> {
  label: string
  linkLabel?: string
  linkUrl?: string
  variant?: 'subtle' | 'boxed'
  value?: boolean
  onChange?: (value: boolean) => void
}

export const ConsentCheckbox: FC<ConsentCheckboxProps> = ({
  className,
  label,
  linkLabel,
  linkUrl,
  variant = 'boxed',
  value = false,
  onChange,
  ...restProps
}) => {
  const handleClick = useCallback(
    (event: any) => {
      stopEvent(event)
      onChange?.(!value)
    },
    [onChange, value]
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        handleClick(event)
      }
    },
    [handleClick]
  )

  return (
    <div
      role="checkbox"
      aria-checked={value}
      tabIndex={0}
      data-neptunysform-focus-target={true}
      className={clsx(
        'neptunysform-consent-option',
        {
          'neptunysform-consent-option-subtle': variant === 'subtle',
          'neptunysform-consent-option-selected': value
        },
        'w-full',
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      {...restProps}
    >
      <span className="neptunysform-consent-box" aria-hidden="true">
        <IconCheck className="neptunysform-consent-box-icon" />
      </span>
      <span className="neptunysform-consent-text">
        {label}
        {linkLabel && linkUrl && (
          <a
            href={linkUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="neptunysform-consent-link"
            onClick={event => event.stopPropagation()}
          >
            {linkLabel}
          </a>
        )}
      </span>
    </div>
  )
}