import { COUNTRIES, FlagIcon } from '@heyform-inc/form-renderer'
import { IconCheck, IconChevronDown, IconChevronRight } from '@tabler/icons-react'
import clsx from 'clsx'
import type { FC } from 'react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { FakeSelect } from '../FakeSelect'
import { FakeSubmit } from '../FakeSubmit'
import type { BlockProps } from './Block'
import { Block } from './Block'

export const ContactInfo: FC<BlockProps> = ({ field, locale, ...restProps }) => {
  const { t } = useTranslation()
  const showFirstName = field.properties?.showFirstName ?? field.properties?.fullNameMode !== 'last'
  const showLastName = field.properties?.showLastName ?? field.properties?.fullNameMode !== 'first'
  const showBothNameFields = showFirstName && showLastName
  const showPhoneNumber = field.properties?.showPhoneNumber ?? true
  const showEmail = field.properties?.showEmail ?? true
  const showCompany = field.properties?.showCompany ?? true
  const showConsent = field.properties?.showConsent ?? false
  const consentText = field.properties?.consentText || 'I consent to being contacted about my enquiry.'
  const consentLinkLabel = field.properties?.consentLinkLabel
  const consentLinkUrl = field.properties?.consentLinkUrl
  const selectedCountry = useMemo(
    () =>
      COUNTRIES.find(country => country.value === field.properties?.defaultCountryCode) ||
      COUNTRIES.find(country => country.value === 'US'),
    [field.properties?.defaultCountryCode]
  )

  return (
    <Block className="heyform-contact-info" field={field} locale={locale} {...restProps}>
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          {showFirstName && (
            <input
              type="text"
              className={clsx('heyform-input', showBothNameFields ? 'w-full sm:flex-1' : 'w-full')}
              placeholder={t('First Name', { lng: locale })}
              disabled={true}
            />
          )}

          {showLastName && (
            <input
              type="text"
              className={clsx('heyform-input', showBothNameFields ? 'w-full sm:flex-1' : 'w-full')}
              placeholder={t('Last Name', { lng: locale })}
              disabled={true}
            />
          )}
        </div>

        {showPhoneNumber && (
          <div className="heyform-phone-number">
            <div className="flex items-center">
              <div className="heyform-calling-code">
                <FlagIcon countryCode={selectedCountry?.value} />
                {field.properties?.hideCountrySelect ? (
                  <span className="heyform-phone-static-code">+{selectedCountry?.callingCode}</span>
                ) : (
                  <IconChevronDown className="heyform-phone-arrow-icon" />
                )}
              </div>
              <input type="text" className="heyform-input" placeholder={selectedCountry?.example} disabled={true} />
            </div>
          </div>
        )}

        {showEmail && (
          <input type="email" className="heyform-input" placeholder="email@example.com" disabled={true} />
        )}

        {showCompany && (
          <input
            type="text"
            className="heyform-input"
            placeholder={t('Company', { lng: locale })}
            disabled={true}
          />
        )}

        {showConsent && (
          <div className="w-full max-w-[28rem] pt-1">
            <div
              className={`heyform-consent-option${field.properties?.defaultChecked ? ' heyform-consent-option-selected' : ''}`}
            >
              <span className="heyform-consent-box" aria-hidden="true">
                <IconCheck className="heyform-consent-box-icon" />
              </span>
              <span className="heyform-consent-text">
                {consentText || t('I accept', { lng: locale })}
                {consentLinkLabel && consentLinkUrl && (
                  <a
                    href={consentLinkUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="heyform-consent-link"
                    onClick={event => event.stopPropagation()}
                  >
                    {consentLinkLabel}
                  </a>
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      <FakeSubmit text={t('Next', { lng: locale })} icon={<IconChevronRight />} />
    </Block>
  )
}