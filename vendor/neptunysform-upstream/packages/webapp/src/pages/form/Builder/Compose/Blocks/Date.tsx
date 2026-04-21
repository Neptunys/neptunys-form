import { TIME_FORMAT } from '@neptunysform-inc/form-renderer'
import { IconChevronRight } from '@tabler/icons-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'

import { DATE_FORMAT_MAPS, DATE_FORMAT_NAMES } from '@/consts'

import { FakeSubmit } from '../FakeSubmit'
import type { BlockProps } from './Block'
import { Block } from './Block'

interface DateItemProps {
  format: string
  locale: string
}

export const DateItem: FC<DateItemProps> = ({ format, locale }) => {
  const { t } = useTranslation()
  const dateFormat = DATE_FORMAT_NAMES[format]

  return (
    <div className={`neptunysform-date-item neptunysform-date-item-${dateFormat.id}`}>
      <label htmlFor={`neptunysform-date-${dateFormat.id}`} className="neptunysform-date-label">
        {t(dateFormat.label, { lng: locale })}
      </label>
      <input
        id={`neptunysform-date-${dateFormat.id}`}
        type="text"
        className="neptunysform-input"
        placeholder={format}
        disabled={true}
      />
    </div>
  )
}

export const Date: FC<BlockProps> = ({ field, locale, ...restProps }) => {
  const { t } = useTranslation()
  const format = field.properties?.format || 'MM/DD/YYYY'
  const [x, y, z, dateDivider] = DATE_FORMAT_MAPS[format]
  const [h, m, timeDivider] = DATE_FORMAT_MAPS[TIME_FORMAT]

  return (
    <Block className="neptunysform-date" field={field} locale={locale} {...restProps}>
      <div className="neptunysform-date-root">
        <DateItem format={x} locale={locale} />
        <div className="neptunysform-date-divider">{dateDivider}</div>
        <DateItem format={y} locale={locale} />
        <div className="neptunysform-date-divider">{dateDivider}</div>
        <DateItem format={z} locale={locale} />

        {field.properties?.allowTime && (
          <>
            <DateItem format={h} locale={locale} />
            <div className="neptunysform-date-divider">{timeDivider}</div>
            <DateItem format={m} locale={locale} />
          </>
        )}
      </div>
      <FakeSubmit text={t('Next', { lng: locale })} icon={<IconChevronRight />} />
    </Block>
  )
}
