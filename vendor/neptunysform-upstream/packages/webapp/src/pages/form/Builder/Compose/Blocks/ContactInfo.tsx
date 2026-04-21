import { COUNTRIES, FlagIcon } from '@neptunysform-inc/form-renderer'
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
    <div className={clsx('neptunysform-contact-field-shell', className)}>
      <span className="neptunysform-contact-field-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="neptunysform-contact-field-control">{children}</div>
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
    <Block className="neptunysform-contact-info" field={field} locale={locale} {...restProps}>
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
                className="neptunysform-input"
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
                className="neptunysform-input"
                placeholder={t('Last Name', { lng: locale })}
                disabled={true}
              />
            </ContactFieldShell>
          )}
        </div>

        {showPhoneNumber && (
          <ContactFieldShell enabled={showFieldIcons} icon={<IconPhone />} className="w-full">
            <div className="neptunysform-phone-number">
              <div className="flex items-center">
                <div className="neptunysform-calling-code">
                  <FlagIcon countryCode={selectedCountry?.value} />
                  {field.properties?.hideCountrySelect ? (
                    <span className="neptunysform-phone-static-code">+{selectedCountry?.callingCode}</span>
                  ) : (
                    <IconChevronDown className="neptunysform-phone-arrow-icon" />
                  )}
                </div>
                <input type="text" className="neptunysform-input" placeholder={selectedCountry?.example} disabled={true} />
              </div>
            </div>
          </ContactFieldShell>
        )}

        {showEmail && (
          <ContactFieldShell enabled={showFieldIcons} icon={<IconMail />} className="w-full">
            <input type="email" className="neptunysform-input" placeholder="email@example.com" disabled={true} />
          </ContactFieldShell>
        )}

        {showCompany && (
          <ContactFieldShell enabled={showFieldIcons} icon={<IconBuilding />} className="w-full">
            <input
              type="text"
              className="neptunysform-input"
              placeholder={t('Company', { lng: locale })}
              disabled={true}
            />
          </ContactFieldShell>
        )}

        {showConsent && (
          <div className="w-full pt-1">
            <div
              className={clsx(
                'neptunysform-consent-option',
                consentStyle === 'subtle' && 'neptunysform-consent-option-subtle',
                field.properties?.defaultChecked && 'neptunysform-consent-option-selected'
              )}
            >
              <span className="neptunysform-consent-box" aria-hidden="true">
                <IconCheck className="neptunysform-consent-box-icon" />
              </span>
              <span className="neptunysform-consent-text">
                {consentText || t('I accept', { lng: locale })}
                {consentLinkLabel && consentLinkUrl && (
                  <a
                    href={consentLinkUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="neptunysform-consent-link"
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