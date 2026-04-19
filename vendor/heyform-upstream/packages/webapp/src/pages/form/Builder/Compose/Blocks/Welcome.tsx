import type { FC } from 'react'
import { RefObject, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

import { FakeSubmit } from '../FakeSubmit'
import type { BlockProps } from './Block'
import { Block } from './Block'
import { RichText } from '../../RichText'
import { useStoreContext } from '../../store'

export const Welcome: FC<BlockProps> = ({ field, locale, ...restProps }) => {
  const { dispatch } = useStoreContext()
  const { t } = useTranslation()
  const buttonSubtext = field.properties?.buttonSubtext
  const helperRef = useRef<HTMLDivElement>(undefined)

  const handleButtonSubtextChange = useCallback(
    (value: string) => {
      dispatch({
        type: 'updateField',
        payload: {
          id: field.id,
          updates: {
            properties: {
              ...field.properties,
              buttonSubtext: value
            }
          }
        }
      })
    },
    [dispatch, field.id, field.properties]
  )

  return (
    <Block
      className={clsx(
        'heyform-welcome heyform-empty-state',
        field.layout?.contentAlign && `heyform-welcome-align-${field.layout.contentAlign}`,
        field.layout?.titleSize && field.layout.titleSize !== 'normal' && `heyform-welcome-title-${field.layout.titleSize}`,
        typeof field.layout?.titleSizePx === 'number' && 'heyform-welcome-title-custom'
      )}
      field={field}
      locale={locale}
      style={{
        '--heyform-welcome-title-size-px':
          typeof field.layout?.titleSizePx === 'number' ? `${field.layout.titleSizePx}px` : undefined
      }}
      {...restProps}
    >
      <FakeSubmit
        className="heyform-submit-with-helper"
        text={field.properties?.buttonText || t('Next', { lng: locale })}
        helper={
          <RichText
            className="heyform-block-description"
            innerRef={helperRef as RefObject<HTMLDivElement>}
            placeholder={t('Button helper text')}
            value={buttonSubtext || ''}
            onChange={handleButtonSubtextChange}
          />
        }
      />
    </Block>
  )
}
