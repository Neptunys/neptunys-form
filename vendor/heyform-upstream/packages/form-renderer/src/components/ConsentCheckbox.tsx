import { IconCheck } from '@tabler/icons-react'
import clsx from 'clsx'
import type { FC } from 'react'
import { useCallback } from 'react'

import { stopEvent } from '../utils'

import { IComponentProps } from '../typings'

interface ConsentCheckboxProps extends Omit<IComponentProps<HTMLButtonElement>, 'onChange'> {
  label: string
  value?: boolean
  onChange?: (value: boolean) => void
}

export const ConsentCheckbox: FC<ConsentCheckboxProps> = ({
  className,
  label,
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

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={value}
      data-heyform-focus-target={true}
      className={clsx(
        'heyform-consent-option',
        {
          'heyform-consent-option-selected': value
        },
        className
      )}
      onClick={handleClick}
      {...restProps}
    >
      <span className="heyform-consent-box" aria-hidden="true">
        <IconCheck className="heyform-consent-box-icon" />
      </span>
      <span className="heyform-consent-text">{label}</span>
    </button>
  )
}