import { COUNTRIES, FlagIcon } from '@neptunysform-inc/form-renderer'
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react'
import type { FC } from 'react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { FakeSubmit } from '../FakeSubmit'
import type { BlockProps } from './Block'
import { Block } from './Block'

export const PhoneNumber: FC<BlockProps> = ({ field, locale, ...restProps }) => {
  const { t } = useTranslation()
  const selectedCountry = useMemo(
    () =>
      COUNTRIES.find(c => c.value === field.properties?.defaultCountryCode) ||
      COUNTRIES.find(c => c.value === 'US'),
    [field.properties?.defaultCountryCode]
  )
  const placeholder = useMemo(
    () => selectedCountry?.example,
    [selectedCountry]
  )
  const hideCountrySelect = field.properties?.hideCountrySelect === true

  return (
    <Block className="neptunysform-phone-number" field={field} locale={locale} {...restProps}>
      <div className="flex items-center">
        <div className="neptunysform-calling-code">
          <FlagIcon countryCode={selectedCountry?.value} />
          {hideCountrySelect ? (
            <span className="neptunysform-phone-static-code">+{selectedCountry?.callingCode}</span>
          ) : (
            <IconChevronDown className="neptunysform-phone-arrow-icon" />
          )}
        </div>
        <input type="text" className="neptunysform-input" placeholder={placeholder} disabled={true} />
      </div>
      <FakeSubmit text={t('Next', { lng: locale })} icon={<IconChevronRight />} />
    </Block>
  )
}
