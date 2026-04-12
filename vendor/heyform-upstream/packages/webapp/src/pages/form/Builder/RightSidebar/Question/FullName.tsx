import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { Select } from '@/components'

import { useStoreContext } from '../../store'
import { RequiredSettingsProps } from './Required'

export default function FullNameSettings({ field }: RequiredSettingsProps) {
  const { t } = useTranslation()
  const { dispatch } = useStoreContext()
  const nameModeOptions = [
    {
      label: t('form.builder.settings.fullName.modes.both'),
      value: 'both'
    },
    {
      label: t('form.builder.settings.fullName.modes.first'),
      value: 'first'
    },
    {
      label: t('form.builder.settings.fullName.modes.last'),
      value: 'last'
    }
  ]

  const handleChange = useCallback(
    (value: string) => {
      dispatch({
        type: 'updateField',
        payload: {
          id: field.id,
          updates: {
            properties: {
              ...field.properties,
              fullNameMode: value
            }
          }
        }
      })
    },
    [dispatch, field.id, field.properties]
  )

  return (
    <div className="space-y-1">
      <label className="text-sm/6" htmlFor="#">
        {t('form.builder.settings.fullName.fields')}
      </label>

      <Select
        className="mt-2 w-full"
        options={nameModeOptions}
        value={field.properties?.fullNameMode || 'both'}
        onChange={handleChange}
      />
    </div>
  )
}