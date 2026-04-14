import clsx from 'clsx'
import { isValidPhoneNumber } from 'libphonenumber-js'
import type { FC } from 'react'
import { useMemo, useState } from 'react'

import { initialValue, useTranslation } from '../utils'
import { helper } from '@heyform-inc/utils'

import { CountrySelect, FormField, Input, PhoneNumberInput } from '../components'
import { useStore } from '../store'
import type { BlockProps } from './Block'
import { Block } from './Block'
import { Form } from './Form'

function hasFilled(values: any) {
  const fullName = values?.fullName || {}
  const address = values?.address || {}

  return [
    fullName.firstName,
    fullName.lastName,
    values?.email,
    values?.phoneNumber,
    address.address1,
    address.address2,
    address.city,
    address.state,
    address.zip,
    address.country
  ].some(helper.isValid)
}

export const ContactInfo: FC<BlockProps> = ({ field, ...restProps }) => {
  const { state, dispatch } = useStore()
  const { t } = useTranslation()
  const [isDropdownShown, setIsDropdownShown] = useState(false)
  const fullNameMode = field.properties?.fullNameMode || 'both'
  const showFirstName = fullNameMode !== 'last'
  const showLastName = fullNameMode !== 'first'
  const showBothNameFields = showFirstName && showLastName

  const isRequired = useMemo(() => {
    if (field.validations?.required) {
      return true
    }

    if (state.errorFieldId === field.id) {
      return hasFilled(state.values[field.id])
    }

    return false
  }, [field.id, field.validations?.required, state.errorFieldId, state.values])

  function getValues(values: any) {
    return hasFilled(values) ? values : undefined
  }

  function handleValuesChange(_: any, values: any) {
    if (!field.validations?.required && !hasFilled(values)) {
      dispatch({
        type: 'setValues',
        payload: {
          values: {
            [field.id]: undefined
          }
        }
      })
    }
  }

  return (
    <Block
      className={clsx('heyform-contact-info', {
        'heyform-dropdown-visible': isDropdownShown
      })}
      field={field}
      isScrollable={!isDropdownShown}
      {...restProps}
    >
      <Form
        initialValues={initialValue(state.values[field.id])}
        field={field}
        getValues={getValues}
        onValuesChange={handleValuesChange}
      >
        <div className="space-y-4">
          <div className="flex w-full flex-col items-start justify-items-stretch gap-4 sm:flex-row">
            {showFirstName && (
              <FormField
                className={showBothNameFields ? 'w-full sm:flex-1' : 'w-full'}
                name={['fullName', 'firstName']}
                rules={[
                  {
                    required: Boolean(isRequired && showFirstName),
                    message: t('This field is required')
                  }
                ]}
              >
                <Input placeholder={t('First Name')} />
              </FormField>
            )}

            {showLastName && (
              <FormField
                className={showBothNameFields ? 'w-full sm:flex-1' : 'w-full'}
                name={['fullName', 'lastName']}
                rules={[
                  {
                    required: Boolean(isRequired && showLastName),
                    message: t('This field is required')
                  }
                ]}
              >
                <Input placeholder={t('Last Name')} />
              </FormField>
            )}
          </div>

          <FormField
            name="email"
            rules={[
              {
                required: Boolean(isRequired),
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

                    if (helper.isEmail(value)) {
                      resolve()
                    } else {
                      reject(t('Please enter a valid email address'))
                    }
                  })
                }
              }
            ]}
          >
            <Input type="email" placeholder="email@example.com" />
          </FormField>

          <div className="heyform-phone-number">
            <FormField
              name="phoneNumber"
              rules={[
                {
                  required: Boolean(isRequired),
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
                  }
                }
              ]}
            >
              <PhoneNumberInput
                defaultCountryCode={field.properties?.defaultCountryCode}
                hideCountrySelect={field.properties?.hideCountrySelect}
                onDropdownVisibleChange={setIsDropdownShown}
              />
            </FormField>
          </div>

          <FormField
            name={['address', 'address1']}
            rules={[
              {
                required: Boolean(isRequired),
                message: t('This field is required')
              }
            ]}
          >
            <Input placeholder={t('Address Line 1')} />
          </FormField>

          <FormField name={['address', 'address2']}>
            <Input placeholder={t('Address Line 2 (optional)')} />
          </FormField>

          <div className="flex w-full flex-col items-start justify-items-stretch gap-4 sm:flex-row">
            <FormField
              className="w-full sm:flex-1"
              name={['address', 'city']}
              rules={[
                {
                  required: Boolean(isRequired),
                  message: t('This field is required')
                }
              ]}
            >
              <Input placeholder={t('City')} />
            </FormField>

            <FormField
              className="w-full sm:flex-1"
              name={['address', 'state']}
              rules={[
                {
                  required: Boolean(isRequired),
                  message: t('This field is required')
                }
              ]}
            >
              <Input placeholder={t('State/Province')} />
            </FormField>
          </div>

          <div className="flex w-full flex-col items-start justify-items-stretch gap-4 sm:flex-row">
            <FormField
              className="w-full sm:flex-1"
              name={['address', 'zip']}
              rules={[
                {
                  required: Boolean(isRequired),
                  message: t('This field is required')
                }
              ]}
            >
              <Input placeholder={t('Zip/Postal Code')} />
            </FormField>

            <FormField
              className="w-full sm:flex-1"
              name={['address', 'country']}
              rules={[
                {
                  required: Boolean(isRequired),
                  message: t('This field is required')
                }
              ]}
            >
              <CountrySelect placeholder={t('Country')} onDropdownVisibleChange={setIsDropdownShown} />
            </FormField>
          </div>
        </div>
      </Form>
    </Block>
  )
}