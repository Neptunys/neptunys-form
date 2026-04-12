import { Choice } from '@heyform-inc/shared-types-enums'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'

import { Select } from '@/components'
import { clone, helper } from '@heyform-inc/utils'

import { LEAD_SCORE_OPTIONS, normalizeLeadScore } from '../../utils/lead-score'
import { useStoreContext } from '../../store'
import { FakeRadio } from '../FakeRadio'
import type { BlockProps } from './Block'
import { Block } from './Block'

export const YesNo: FC<BlockProps> = ({ field, locale, ...restProps }) => {
  const { t } = useTranslation()
  const { dispatch } = useStoreContext()

  const choices = (field.properties?.choices || [
    { id: 'yes', label: 'Yes' },
    { id: 'no', label: 'No' }
  ]) as Choice[]

  function handleScoreChange(id: string, score?: number) {
    const nextChoices = clone(choices)
    const index = nextChoices.findIndex(choice => choice.id === id)

    if (index < 0) {
      return
    }

    nextChoices[index].score = normalizeLeadScore(score)

    dispatch({
      type: 'updateField',
      payload: {
        id: field.id,
        updates: {
          properties: {
            ...field.properties,
            choices: nextChoices
          }
        }
      }
    })
  }

  return (
    <Block className="heyform-yes-no" field={field} locale={locale} {...restProps}>
      <div className="heyform-radio-group w-full max-w-xs gap-3">
        {choices.map((choice, index) => (
          <div key={choice.id} className="flex items-center gap-3">
            <div className="flex-1">
              <FakeRadio
                hotkey={index === 0 ? 'Y' : 'N'}
                label={index === 0 ? t('Yes', { lng: locale }) : t('No', { lng: locale })}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-text-light text-[11px] font-medium uppercase tracking-[0.08em]">
                Score
              </span>
              <Select
                className="w-32"
                allowClear
                placeholder="0-3"
                options={LEAD_SCORE_OPTIONS}
                value={choice.score ?? ''}
                onChange={value =>
                  handleScoreChange(choice.id, normalizeLeadScore(value))
                }
              />
            </div>
          </div>
        ))}
      </div>
    </Block>
  )
}
