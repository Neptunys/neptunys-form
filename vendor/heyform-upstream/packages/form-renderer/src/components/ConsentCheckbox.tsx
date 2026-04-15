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
  value?: boolean
  onChange?: (value: boolean) => void
}

export const ConsentCheckbox: FC<ConsentCheckboxProps> = ({
  className,
  label,
  linkLabel,
  linkUrl,
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
      data-heyform-focus-target={true}
      className={clsx(
        'heyform-consent-option',
        {
          'heyform-consent-option-selected': value
        },
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      {...restProps}
    >
      <span className="heyform-consent-box" aria-hidden="true">
        <IconCheck className="heyform-consent-box-icon" />
      </span>
      <span className="heyform-consent-text">
        {label}
        {linkLabel && linkUrl && (
          <a
            href={linkUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="heyform-consent-link"
            onClick={event => event.stopPropagation()}
          >
            {linkLabel}
          </a>
        )}
      </span>
    </div>
  )
}