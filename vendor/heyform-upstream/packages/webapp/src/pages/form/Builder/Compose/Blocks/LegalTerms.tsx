import { IconCheck } from '@tabler/icons-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'

import type { BlockProps } from './Block'
import { Block } from './Block'

export const LegalTerms: FC<BlockProps> = ({ field, locale, ...restProps }) => {
  const { t } = useTranslation()
  const consentText =
    field.properties?.consentText || 'I agree to the terms and privacy policy.'
  const consentLinkLabel = field.properties?.consentLinkLabel
  const consentLinkUrl = field.properties?.consentLinkUrl
  const isDefaultChecked = field.properties?.defaultChecked === true

  return (
    <Block className="heyform-legal-terms" field={field} locale={locale} {...restProps}>
      <div className="w-full max-w-[28rem]">
        <div className={`heyform-consent-option${isDefaultChecked ? ' heyform-consent-option-selected' : ''}`}>
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
    </Block>
  )
}
