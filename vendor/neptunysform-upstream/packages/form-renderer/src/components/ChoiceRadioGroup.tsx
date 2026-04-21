import { ChoiceBadgeEnum } from '@neptunysform-inc/shared-types-enums'
import clsx from 'clsx'
import { FC, useCallback, useEffect, useMemo, useState } from 'react'

import { getChoiceKeyName, useTranslation } from '../utils'
import { helper } from '@neptunysform-inc/utils'

import { IComponentProps } from '../typings'
import type { ChoiceRadioOption } from './ChoiceRadio'
import { ChoiceRadio } from './ChoiceRadio'

interface ChoiceRadioGroupProps extends Omit<IComponentProps, 'onChange'> {
  options: ChoiceRadioOption[]
  allowMultiple?: boolean
  allowOther?: boolean
  badge?: ChoiceBadgeEnum
  verticalAlignment?: boolean
  isOtherFilled?: boolean
  isHotkeyShow?: boolean
  selectionFeedback?: boolean
  max?: number
  enableImage?: boolean
  value?: any
  onChange?: (value: any) => void
}

function resetArray(arr: any) {
  return (helper.isArray(arr) ? arr : [arr]).filter(helper.isValid)
}

export const ChoiceRadioGroup: FC<ChoiceRadioGroupProps> = ({
  className,
  options,
  allowMultiple = false,
  allowOther = false,
  badge = ChoiceBadgeEnum.LETTER,
  verticalAlignment = true,
  isOtherFilled = false,
  isHotkeyShow = true,
  selectionFeedback = false,
  max = 0,
  enableImage,
  value: rawValue,
  onChange,
  ...restProps
}) => {
  const { t } = useTranslation()
  const isMultipleSelection = helper.isTrue(allowMultiple)

  const values = useMemo(() => resetArray(rawValue?.value || []), [rawValue])
  const otherValue = useMemo(() => rawValue?.other, [rawValue])

  const isDisabled = useMemo(
    () => max > 0 && values.length + (allowOther && isOtherFilled ? 1 : 0) >= max,
    [allowOther, isOtherFilled, max, values.length]
  )
  const [isOtherSelected, setIsOtherSelected] = useState(false)

  const handleClick = useCallback(
    (value: any) => {
      let newValues: any[]

      if (!isMultipleSelection) {
        newValues = [value]
        setIsOtherSelected(false)
      } else {
        if (values.includes(value)) {
          newValues = values.filter((v: any) => v !== value)
        } else {
          newValues = isDisabled ? values : [...values, value]
        }
      }

      onChange?.({
        value: newValues,
        other: otherValue
      })
    },
    [isDisabled, isMultipleSelection, onChange, otherValue, values]
  )

  const handleOtherChange = useCallback(
    (newOtherValue: string) => {
      let other: string | undefined = newOtherValue

      if (helper.isEmpty(other)) {
        other = undefined
        setIsOtherSelected(false)
      }

      onChange?.({
        value: values,
        other
      })
    },
    [onChange, values]
  )

  const handleOtherBlur = useCallback(() => {
    if (helper.isEmpty(otherValue)) {
      setIsOtherSelected(false)
    }
  }, [otherValue])

  const handleOtherClick = useCallback(() => {
    if (isDisabled) {
      return
    }

    setIsOtherSelected(true)

    if (!isOtherSelected && !isMultipleSelection) {
      onChange?.({
        value: [],
        other: otherValue
      })
    }
  }, [isDisabled, isMultipleSelection, isOtherSelected, onChange, otherValue])

  useEffect(() => {
    if (allowOther) {
      setIsOtherSelected(helper.isValid(otherValue))
    }
  }, [])

  return (
    <div
      className={clsx(
        'neptunysform-radio-group',
        {
          'neptunysform-radio-group-disabled': isDisabled,
          'neptunysform-radio-group-horizontal': helper.isFalse(verticalAlignment)
        },
        className
      )}
      {...restProps}
    >
      {options.map(option => (
        <ChoiceRadio
          key={option.value as string}
          {...option}
          enableImage={enableImage}
          isHotkeyShow={isHotkeyShow}
          isChecked={values.includes(option.value)}
          autoAdvanceFeedback={selectionFeedback}
          onClick={handleClick}
        />
      ))}

      {allowOther && (
        <ChoiceRadio
          className="neptunysform-radio-other"
          keyName={getChoiceKeyName(badge, options.length)}
          enableImage={enableImage}
          label={t('Other')}
          value={otherValue}
          isHotkeyShow={isHotkeyShow}
          isChecked={isOtherSelected}
          isOther={true}
          autoAdvanceFeedback={selectionFeedback}
          onBlur={handleOtherBlur}
          onClick={handleOtherClick}
          onChange={handleOtherChange}
        />
      )}
    </div>
  )
}
