import type { CSSProperties, FC } from 'react'
import { useTranslation } from 'react-i18next'

import type { BlockProps } from './Block'
import { Block } from './Block'

export const LegalTerms: FC<BlockProps> = ({ field, locale, ...restProps }) => {
  const { t } = useTranslation()
  const cardStyle: CSSProperties = {
    borderColor: 'var(--heyform-answer-opacity-30-color)',
    backgroundColor: 'var(--heyform-answer-opacity-10-color)'
  }
  const checkboxStyle: CSSProperties = {
    borderColor: 'var(--heyform-answer-opacity-60-color)'
  }
  const consentText =
    field.properties?.consentText || 'I agree to the terms and privacy policy.'

  return (
    <Block className="heyform-legal-terms" field={field} locale={locale} {...restProps}>
      <div
        className="flex w-full max-w-[28rem] items-start gap-3 rounded-lg border px-4 py-3"
        style={cardStyle}
      >
        <div className="mt-0.5 flex h-5 w-5 shrink-0 rounded border" style={checkboxStyle} />
        <div className="text-left text-base leading-6" style={{ color: 'var(--heyform-answer-color)' }}>
          {consentText || t('I accept', { lng: locale })}
        </div>
      </div>
    </Block>
  )
}
