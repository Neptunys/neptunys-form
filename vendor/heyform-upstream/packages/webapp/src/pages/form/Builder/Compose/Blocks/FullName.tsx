import clsx from 'clsx'
import { IconChevronRight } from '@tabler/icons-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'

import { FakeSubmit } from '../FakeSubmit'
import type { BlockProps } from './Block'
import { Block } from './Block'

export const FullName: FC<BlockProps> = ({ field, locale, ...restProps }) => {
  const { t } = useTranslation()
  const fullNameMode = field.properties?.fullNameMode || 'both'
  const showFirstName = fullNameMode !== 'last'
  const showLastName = fullNameMode !== 'first'
  const showBothFields = showFirstName && showLastName

  return (
    <Block className="heyform-full-name" field={field} locale={locale} {...restProps}>
      <div className={clsx('flex items-center', { 'space-x-4': showBothFields })}>
        {showFirstName && (
          <input
            type="text"
            className={clsx('heyform-input', { 'flex-1': showBothFields })}
            placeholder={t('First Name', { lng: locale })}
            disabled={true}
          />
        )}
        {showLastName && (
          <input
            type="text"
            className={clsx('heyform-input', { 'flex-1': showBothFields })}
            placeholder={t('Last Name', { lng: locale })}
            disabled={true}
          />
        )}
      </div>
      <FakeSubmit text={t('Next', { lng: locale })} icon={<IconChevronRight />} />
    </Block>
  )
}
