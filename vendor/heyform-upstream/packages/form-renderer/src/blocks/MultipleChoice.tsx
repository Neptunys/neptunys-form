import { FC, useEffect, useState } from 'react'

import { useTranslation } from '../utils'
import { helper } from '@heyform-inc/utils'

import { ChoiceRadioGroup, FormField, RadioGroup, SelectHelper } from '../components'
import { useStore } from '../store'
import type { BlockProps } from './Block'
import { Block } from './Block'
import { Form } from './Form'
import { useChoicesOption, useSelectionRange } from './hook'

export const MultipleChoice: FC<BlockProps> = ({ field, ...restProps }) => {
  const { state } = useStore()
  const { t } = useTranslation()

  const [isOtherFilled, setIsOtherFilled] = useState(false)

  const options = useChoicesOption(
    field.properties?.choices,
    field.properties?.randomize,
    state.translations?.[state.locale]?.[field.id]?.choices,
    field.properties?.badge
  )
  const { min, max, allowMultiple } = useSelectionRange(
    field.properties?.allowMultiple,
    field.validations?.min,
    field.validations?.max
  )
  const allowOther = helper.isTrue(field.properties?.allowOther)
  const singleSelectAutoSubmit = !allowMultiple
  const usePlainSingleSelect = !allowMultiple && !allowOther

  function getFieldValue(formValues: any) {
    return formValues?.value ?? formValues?.input
  }

  function getSelectedValues(value: any) {
    if (helper.isValidArray(value?.value)) {
      return value.value
    }

    if (helper.isValidArray(value)) {
      return value
    }

    return []
  }

  function getOtherValue(value: any) {
    return helper.isObject(value) ? value.other : undefined
  }

  function getValues(formValues: any) {
    const fieldValue = getFieldValue(formValues)
    const selectedValues = getSelectedValues(fieldValue)
    const otherValue = getOtherValue(fieldValue)

    return helper.isValidArray(selectedValues) || helper.isValid(otherValue)
      ? {
          value: selectedValues,
          other: otherValue
        }
      : undefined
  }

  function getChoiceCount(value: any) {
    let count = getSelectedValues(value).length

    if (allowOther && helper.isValid(getOtherValue(value))) {
      count += 1
    }

    return count
  }

  function validateChoiceValue(_: any, value: any) {
    const count = getChoiceCount(value)

    if (field.validations?.required && count < 1) {
      return Promise.reject(t('This field is required'))
    }

    if (!field.validations?.required && count < 1) {
      return Promise.resolve()
    }

    if (count < min) {
      return Promise.reject(
        t('Choose at least {{min}} choices', { min: field.validations?.min })
      )
    }

    if (max > 0 && count > max) {
      return Promise.reject(
        t('Choose up to {{max}} choices', { max: field.validations?.max })
      )
    }

    return Promise.resolve()
  }

  function handleValuesChange(_: any, values: any) {
    setIsOtherFilled(helper.isValid(getOtherValue(getFieldValue(values))))
  }

  useEffect(() => {
    const value = state.values[field.id]

    setIsOtherFilled(helper.isValid(value?.other))
  }, [field.id, state.values])

  return (
    <Block className="heyform-multiple-choice" field={field} {...restProps}>
      <SelectHelper min={min} max={max} />

      <Form
        initialValues={{
          ...(usePlainSingleSelect
            ? {
                input: getSelectedValues(state.values[field.id])
              }
            : {
                value: state.values[field.id]
              })
        }}
        autoSubmit={singleSelectAutoSubmit}
        autoSubmitDelayMs={singleSelectAutoSubmit ? 420 : 80}
        allowAutoSubmitWithNextButton={singleSelectAutoSubmit}
        isSubmitShow={true}
        field={field}
        getValues={getValues}
        onValuesChange={handleValuesChange}
      >
        {usePlainSingleSelect ? (
          <FormField
            name="input"
            rules={[
              {
                validator: validateChoiceValue
              }
            ]}
          >
            <RadioGroup
              className={
                helper.isFalse(field.properties?.verticalAlignment)
                  ? 'w-full heyform-radio-group-horizontal'
                  : 'w-full'
              }
              options={options}
              selectionFeedback={singleSelectAutoSubmit}
            />
          </FormField>
        ) : (
          <FormField
            name="value"
            rules={[
              {
                validator: validateChoiceValue
              }
            ]}
          >
            <ChoiceRadioGroup
              options={options}
              allowMultiple={field.properties?.allowMultiple}
              allowOther={field.properties?.allowOther}
              badge={field.properties?.badge}
              verticalAlignment={field.properties?.verticalAlignment}
              isOtherFilled={isOtherFilled}
              selectionFeedback={singleSelectAutoSubmit}
              max={field.validations?.max ?? 0}
            />
          </FormField>
        )}
      </Form>
    </Block>
  )
}
