import clsx from 'clsx'
import type { FC } from 'react'
import { useCallback, useMemo } from 'react'

import { helper } from '@neptunysform-inc/utils'

import { IComponentProps } from '../typings'
import type { RadioOption } from './Radio'
import { Radio } from './Radio'

interface RadioGroupProps extends Omit<IComponentProps, 'onChange'> {
  options: RadioOption[]
  allowMultiple?: boolean
  isHotkeyShow?: boolean
  selectionFeedback?: boolean
  max?: number
  enableImage?: boolean
  value?: any
  onChange?: (values: any[]) => void
}

function resetArray(arr: any) {
  return (helper.isArray(arr) ? arr : [arr]).filter(helper.isValid)
}

export const RadioGroup: FC<RadioGroupProps> = ({
  className,
  options,
  allowMultiple = false,
  isHotkeyShow = true,
  selectionFeedback = false,
  max = 0,
  enableImage,
  value: rawValue,
  onChange,
  ...restProps
}) => {
  const isMultipleSelection = helper.isTrue(allowMultiple)
  const values = useMemo(() => resetArray(rawValue), [rawValue])
  const isDisabled = useMemo(() => max > 0 && values.length >= max, [values, max])

  function handleClick(value: any) {
    let newValues: any[]

    if (!isMultipleSelection) {
      newValues = [value]
    } else {
      if (values.includes(value)) {
        newValues = values.filter(v => v !== value)
      } else {
        newValues = isDisabled ? values : [...values, value]
      }
    }

    onChange?.(newValues)
  }

  const handleClickCallback = useCallback(handleClick, [isDisabled, isMultipleSelection, onChange, values])

  return (
    <div
      className={clsx(
        'neptunysform-radio-group',
        {
          'neptunysform-radio-group-disabled': isDisabled
        },
        className
      )}
      {...restProps}
    >
      {options.map(option => (
        <Radio
          key={option.value as string}
          {...option}
          enableImage={enableImage}
          isHotkeyShow={isHotkeyShow}
          isChecked={values.includes(option.value)}
          autoAdvanceFeedback={selectionFeedback}
          onClick={handleClickCallback}
        />
      ))}
    </div>
  )
}
