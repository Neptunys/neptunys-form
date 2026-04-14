import { COUNTRIES, FlagIcon } from '@heyform-inc/form-renderer'
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react'
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
  const fullNameMode = field.properties?.fullNameMode || 'both'
  const showFirstName = fullNameMode !== 'last'
  const showLastName = fullNameMode !== 'first'
  const showBothNameFields = showFirstName && showLastName
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

        <input type="email" className="heyform-input" placeholder="email@example.com" disabled={true} />

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

        <input
          type="text"
          className="heyform-input"
          placeholder={t('Address Line 1', { lng: locale })}
          disabled={true}
        />
        <input
          type="text"
          className="heyform-input"
          placeholder={t('Address Line 2 (optional)', { lng: locale })}
          disabled={true}
        />

        <div className="flex flex-col gap-4 sm:flex-row">
          <input
            type="text"
            className="heyform-input w-full sm:flex-1"
            placeholder={t('City', { lng: locale })}
            disabled={true}
          />
          <input
            type="text"
            className="heyform-input w-full sm:flex-1"
            placeholder={t('State/Province', { lng: locale })}
            disabled={true}
          />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <input
            type="text"
            className="heyform-input w-full sm:flex-1"
            placeholder={t('Zip/Postal Code', { lng: locale })}
            disabled={true}
          />
          <div className="w-full sm:flex-1">
            <FakeSelect placeholder={t('Country', { lng: locale })} />
          </div>
        </div>
      </div>

      <FakeSubmit text={t('Next', { lng: locale })} icon={<IconChevronRight />} />
    </Block>
  )
}