import { COUNTRIES, FlagIcon } from '@heyform-inc/form-renderer'
import { IconBuilding, IconCheck, IconChevronDown, IconChevronRight, IconMail, IconPhone, IconUser } from '@tabler/icons-react'
import clsx from 'clsx'
import type { FC, ReactNode } from 'react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { FakeSelect } from '../FakeSelect'
import { FakeSubmit } from '../FakeSubmit'
import type { BlockProps } from './Block'
import { Block } from './Block'

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
    <div className={clsx('heyform-contact-field-shell', className)}>
      <span className="heyform-contact-field-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="heyform-contact-field-control">{children}</div>
    </div>
  )
}

export const ContactInfo: FC<BlockProps> = ({ field, locale, ...restProps }) => {
  const { t } = useTranslation()
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
            <ContactFieldShell
              enabled={showFieldIcons}
              icon={<IconUser />}
              className={showBothNameFields ? 'w-full sm:flex-1' : 'w-full'}
            >
              <input
                type="text"
                className="heyform-input"
                placeholder={t('First Name', { lng: locale })}
                disabled={true}
              />
            </ContactFieldShell>
          )}

          {showLastName && (
            <ContactFieldShell
              enabled={showFieldIcons}
              icon={<IconUser />}
              className={showBothNameFields ? 'w-full sm:flex-1' : 'w-full'}
            >
              <input
                type="text"
                className="heyform-input"
                placeholder={t('Last Name', { lng: locale })}
                disabled={true}
              />
            </ContactFieldShell>
          )}
        </div>

        {showPhoneNumber && (
          <ContactFieldShell enabled={showFieldIcons} icon={<IconPhone />} className="w-full">
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
          </ContactFieldShell>
        )}

        {showEmail && (
          <ContactFieldShell enabled={showFieldIcons} icon={<IconMail />} className="w-full">
            <input type="email" className="heyform-input" placeholder="email@example.com" disabled={true} />
          </ContactFieldShell>
        )}

        {showCompany && (
          <ContactFieldShell enabled={showFieldIcons} icon={<IconBuilding />} className="w-full">
            <input
              type="text"
              className="heyform-input"
              placeholder={t('Company', { lng: locale })}
              disabled={true}
            />
          </ContactFieldShell>
        )}

        {showConsent && (
          <div className="w-full pt-1">
            <div
              className={clsx(
                'heyform-consent-option',
                consentStyle === 'subtle' && 'heyform-consent-option-subtle',
                field.properties?.defaultChecked && 'heyform-consent-option-selected'
              )}
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