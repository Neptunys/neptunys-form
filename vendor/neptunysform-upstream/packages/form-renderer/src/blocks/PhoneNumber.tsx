import clsx from 'clsx'
import { isValidPhoneNumber } from 'libphonenumber-js'
import type { FC } from 'react'
import { useState } from 'react'

import { getPrefilledPhoneNumber, initialValue, useTranslation } from '../utils'
import { helper } from '@neptunysform-inc/utils'

import { FormField, PhoneNumberInput } from '../components'
import { useStore } from '../store'
import type { BlockProps } from './Block'
import { Block } from './Block'
import { Form } from './Form'

export const PhoneNumber: FC<BlockProps> = ({ field, ...restProps }) => {
  const { state } = useStore()
  const { t } = useTranslation()
  const [isDropdownShown, setIsDropdownShown] = useState(false)
  const prefilledPhoneNumber = getPrefilledPhoneNumber(state.query)

  function getValues(values: any) {
    return values.input
  }

  return (
    <Block
      className={clsx('neptunysform-phone-number', {
        'neptunysform-dropdown-visible': isDropdownShown
      })}
      field={field}
      isScrollable={!isDropdownShown}
      {...restProps}
    >
      <Form
        initialValues={{
          input: initialValue(state.values[field.id]) ?? prefilledPhoneNumber
        }}
        autoComplete="on"
        field={field}
        getValues={getValues}
      >
        <FormField
          name="input"
          rules={[
            {
              required: field.validations?.required,
              validator(rule, value) {
                return new Promise<void>((resolve, reject) => {
                  if (helper.isEmpty(value)) {
                    if (rule.required) {
                      reject(t('This field is required'))
                    } else {
                      resolve()
                    }

                    return
                  }

                  if (isValidPhoneNumber(value)) {
                    resolve()
                  } else {
                    reject(t('Please enter a valid mobile phone number'))
                  }
                })
              },
              message: t('Please enter a valid mobile phone number')
            }
          ]}
        >
          <PhoneNumberInput
            name="tel"
            autoComplete="tel"
            defaultCountryCode={field.properties?.defaultCountryCode}
            hideCountrySelect={field.properties?.hideCountrySelect}
            onDropdownVisibleChange={setIsDropdownShown}
          />
        </FormField>
      </Form>
    </Block>
  )
}
