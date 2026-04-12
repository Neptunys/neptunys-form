import clsx from 'clsx'
import { isValidPhoneNumber } from 'libphonenumber-js'
import type { FC } from 'react'
import { useState } from 'react'

import { useTranslation } from '../utils'
import { helper } from '@heyform-inc/utils'

import { FormField, PhoneNumberInput } from '../components'
import { useStore } from '../store'
import type { BlockProps } from './Block'
import { Block } from './Block'
import { Form } from './Form'

export const PhoneNumber: FC<BlockProps> = ({ field, ...restProps }) => {
  const { state } = useStore()
  const { t } = useTranslation()
  const [isDropdownShown, setIsDropdownShown] = useState(false)

  function getValues(values: any) {
    return values.input
  }

  return (
    <Block
      className={clsx('heyform-phone-number', {
        'heyform-dropdown-visible': isDropdownShown
      })}
      field={field}
      isScrollable={!isDropdownShown}
      {...restProps}
    >
      <Form
        initialValues={{
          input: state.values[field.id]
        }}
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
            defaultCountryCode={field.properties?.defaultCountryCode}
            hideCountrySelect={field.properties?.hideCountrySelect}
            onDropdownVisibleChange={setIsDropdownShown}
          />
        </FormField>
      </Form>
    </Block>
  )
}
