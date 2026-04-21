import { CURRENCY_SYMBOLS } from '@neptunysform-inc/form-renderer'
import { NumberPrice } from '@neptunysform-inc/shared-types-enums'
import { IconChevronRight } from '@tabler/icons-react'
import type { FC } from 'react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { helper } from '@neptunysform-inc/utils'

import { FakeSubmit } from '../FakeSubmit'
import type { BlockProps } from './Block'
import { Block } from './Block'

export const Payment: FC<BlockProps> = ({ field, locale, ...restProps }) => {
  const { t } = useTranslation()

  const priceString = useMemo(() => {
    const currency = field.properties?.currency || 'USD'
    let price = 0

    if (helper.isValid(field.properties?.price)) {
      if (field.properties!.price!.type === 'number') {
        price = (field.properties!.price as NumberPrice).value || 0
      }
    }

    return CURRENCY_SYMBOLS[currency] + price
  }, [field.properties?.currency, field.properties?.price])

  return (
    <Block className="neptunysform-payment" field={field} locale={locale} {...restProps}>
      <div className="neptunysform-payment-header">
        <p>
          {t('Your credit card will be charged', { lng: locale })}: <strong>{priceString}</strong>
        </p>
      </div>

      <div className="neptunysform-payment-body">
        <div className="neptunysform-payment-item">
          <div className="neptunysform-payment-label">{t('Name on card', { lng: locale })}</div>
          <input type="text" className="neptunysform-input" placeholder="Han Solo" disabled={true} />
        </div>

        <div className="neptunysform-payment-item">
          <div className="neptunysform-payment-label">{t('Card number', { lng: locale })}</div>
          <input
            type="text"
            className="neptunysform-input"
            placeholder="1234 1234 1234 1234"
            disabled={true}
          />
        </div>

        <div className="neptunysform-payment-wrapper">
          <div className="neptunysform-payment-item">
            <div className="neptunysform-payment-label">{t('Expiry date', { lng: locale })}</div>
            <input type="text" className="neptunysform-input" placeholder="MM/YY" disabled={true} />
          </div>
          <div className="neptunysform-payment-item">
            <div className="neptunysform-payment-label">{t('CVC', { lng: locale })}</div>
            <input type="text" className="neptunysform-input" placeholder="123" disabled={true} />
          </div>
        </div>
      </div>

      <FakeSubmit text={t('Next', { lng: locale })} icon={<IconChevronRight />} />
    </Block>
  )
}
