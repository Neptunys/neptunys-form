import { IconBuilding, IconMail, IconPhone, IconUser } from '@tabler/icons-react'
import clsx from 'clsx'
import { isValidPhoneNumber } from 'libphonenumber-js'
import type { FC, ReactNode } from 'react'
import { useMemo, useState } from 'react'

import { getPrefilledContactInfo, initialValue, useTranslation } from '../utils'
import { helper } from '@neptunysform-inc/utils'

import { ConsentCheckbox, FormField, Input, PhoneNumberInput } from '../components'
import { useStore } from '../store'
import type { BlockProps } from './Block'
import { Block } from './Block'
import { Form } from './Form'

function normalizeContactInfoValue(value: any) {
  if (!helper.isObject(value)) {
    return {}
  }

  return {
    ...value,
    firstName: value?.firstName ?? value?.fullName?.firstName,
    lastName: value?.lastName ?? value?.fullName?.lastName
  }
}

function hasFilled(values: any) {
  const normalizedValue = normalizeContactInfoValue(values)

  return [
    normalizedValue.firstName,
    normalizedValue.lastName,
    normalizedValue.email,
    normalizedValue.phoneNumber,
    normalizedValue.company
  ].some(helper.isValid)
}

function ContactFieldShell({
  className,
  icon,
  enabled,
  children
}: {
  className?: string
  icon: ReactNode
  enabled: boolean
  children: ReactNode
}) {
  if (!enabled) {
    return <div className={className}>{children}</div>
  }

  return (
    <div className={clsx('neptunysform-contact-field-shell', className)}>
      <span className="neptunysform-contact-field-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="neptunysform-contact-field-control">{children}</div>
    </div>
  )
}

export const ContactInfo: FC<BlockProps> = ({ field, ...restProps }) => {
  const { state, dispatch } = useStore()
  const { t } = useTranslation()
  const [isDropdownShown, setIsDropdownShown] = useState(false)
  const showFirstName = field.properties?.showFirstName ?? field.properties?.fullNameMode !== 'last'
  const showLastName = field.properties?.showLastName ?? field.properties?.fullNameMode !== 'first'
  const showBothNameFields = showFirstName && showLastName
  const showPhoneNumber = field.properties?.showPhoneNumber ?? true
  const showEmail = field.properties?.showEmail ?? true
  const showCompany = field.properties?.showCompany ?? true
  const showFieldIcons = field.properties?.showFieldIcons ?? false
  const showConsent = field.properties?.showConsent ?? false
  const consentStyle = field.properties?.consentStyle ?? 'subtle'
  const consentText = field.properties?.consentText || 'I consent to being contacted about my enquiry.'
  const consentLinkLabel = field.properties?.consentLinkLabel
  const consentLinkUrl = field.properties?.consentLinkUrl
  const legacyRequired = Boolean(field.validations?.required)
  const firstNameRequired = showFirstName && (field.properties?.firstNameRequired ?? legacyRequired)
  const lastNameRequired = showLastName && (field.properties?.lastNameRequired ?? legacyRequired)
  const phoneNumberRequired = showPhoneNumber && (field.properties?.phoneNumberRequired ?? legacyRequired)
  const emailRequired = showEmail && (field.properties?.emailRequired ?? legacyRequired)
  const companyRequired = showCompany && (field.properties?.companyRequired ?? false)
  const storedValue = normalizeContactInfoValue(state.values[field.id])
  const prefilledContactInfo = useMemo(() => getPrefilledContactInfo(state.query), [state.query])
  const initialFormValues = useMemo(
    () =>
      initialValue({
        ...prefilledContactInfo,
        ...storedValue,
        ...(showConsent
          ? {
              consentAccepted: Object.prototype.hasOwnProperty.call(storedValue, 'consentAccepted')
                ? helper.isTrue((storedValue as any).consentAccepted)
                : helper.isTrue(field.properties?.defaultChecked)
            }
          : {})
      }),
    [field.properties?.defaultChecked, prefilledContactInfo, showConsent, storedValue]
  )
  const hasRequiredFields =
    firstNameRequired || lastNameRequired || phoneNumberRequired || emailRequired || companyRequired

  const isRequired = useMemo(() => {
    if (hasRequiredFields || field.validations?.required) {
      return true
    }

    if (state.errorFieldId === field.id) {
      return hasFilled(state.values[field.id])
    }

    return false
  }, [field.id, field.validations?.required, hasRequiredFields, state.errorFieldId, state.values])

  function getValues(values: any) {
    const normalizedValue = normalizeContactInfoValue(values)

    if (!hasFilled(normalizedValue)) {
      return undefined
    }

    return {
      firstName: normalizedValue.firstName,
      lastName: normalizedValue.lastName,
      email: normalizedValue.email,
      phoneNumber: normalizedValue.phoneNumber,
      company: normalizedValue.company,
      ...(showConsent ? { consentAccepted: helper.isTrue((normalizedValue as any).consentAccepted) } : {})
    }
  }

  function handleValuesChange(_: any, values: any) {
    const normalizedValue = normalizeContactInfoValue(values)

    if (!field.validations?.required && !hasFilled(normalizedValue)) {
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
      className={clsx('neptunysform-contact-info', {
        'neptunysform-dropdown-visible': isDropdownShown
      })}
      field={field}
      isScrollable={!isDropdownShown}
      {...restProps}
    >
      <Form
        initialValues={initialFormValues}
        autoComplete="on"
        field={field}
        getValues={getValues}
        onValuesChange={handleValuesChange}
      >
        <div className="space-y-4">
          <div className="flex w-full flex-col items-start justify-items-stretch gap-4 sm:flex-row">
            {showFirstName && (
              <ContactFieldShell
                enabled={showFieldIcons}
                icon={<IconUser />}
                className={showBothNameFields ? 'w-full sm:flex-1' : 'w-full'}
              >
                <FormField
                  className="w-full"
                  name="firstName"
                  rules={[
                    {
                      required: Boolean(isRequired && firstNameRequired),
                      message: t('This field is required')
                    }
                  ]}
                >
                  <Input name="given-name" autoComplete="given-name" placeholder={t('First Name')} />
                </FormField>
              </ContactFieldShell>
            )}

            {showLastName && (
              <ContactFieldShell
                enabled={showFieldIcons}
                icon={<IconUser />}
                className={showBothNameFields ? 'w-full sm:flex-1' : 'w-full'}
              >
                <FormField
                  className="w-full"
                  name="lastName"
                  rules={[
                    {
                      required: Boolean(isRequired && lastNameRequired),
                      message: t('This field is required')
                    }
                  ]}
                >
                  <Input name="family-name" autoComplete="family-name" placeholder={t('Last Name')} />
                </FormField>
              </ContactFieldShell>
            )}
          </div>

          {showPhoneNumber && (
            <ContactFieldShell enabled={showFieldIcons} icon={<IconPhone />} className="w-full">
              <div className="neptunysform-phone-number">
                <FormField
                  name="phoneNumber"
                  rules={[
                    {
                      required: Boolean(isRequired && phoneNumberRequired),
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
                    name="tel"
                    autoComplete="tel"
                    defaultCountryCode={field.properties?.defaultCountryCode}
                    hideCountrySelect={field.properties?.hideCountrySelect ?? false}
                    onDropdownVisibleChange={setIsDropdownShown}
                  />
                </FormField>
              </div>
            </ContactFieldShell>
          )}

          {showEmail && (
            <ContactFieldShell enabled={showFieldIcons} icon={<IconMail />} className="w-full">
              <FormField
                name="email"
                rules={[
                  {
                    required: Boolean(isRequired && emailRequired),
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
                <Input name="email" autoComplete="email" type="email" placeholder="email@example.com" />
              </FormField>
            </ContactFieldShell>
          )}

          {showCompany && (
            <ContactFieldShell enabled={showFieldIcons} icon={<IconBuilding />} className="w-full">
              <FormField
                name="company"
                rules={[
                  {
                    required: Boolean(isRequired && companyRequired),
                    message: t('This field is required')
                  }
                ]}
              >
                <Input name="organization" autoComplete="organization" placeholder={t('Company')} />
              </FormField>
            </ContactFieldShell>
          )}

          {showConsent && (
            <FormField name="consentAccepted">
              <ConsentCheckbox
                variant={consentStyle}
                label={consentText}
                linkLabel={consentLinkLabel}
                linkUrl={consentLinkUrl}
              />
            </FormField>
          )}
        </div>
      </Form>
    </Block>
  )
}