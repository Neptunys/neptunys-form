import { RATING_SHAPE_ICONS } from '@neptunysform-inc/form-renderer'
import { startTransition, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Input, Select } from '@/components'
import { helper } from '@neptunysform-inc/utils'

import { useStoreContext } from '../../store'
import { RequiredSettingsProps } from './Required'

export default function Rating({ field }: RequiredSettingsProps) {
  const { t } = useTranslation()
  const { dispatch } = useStoreContext()
  const alignmentItems = [
    {
      value: 'left',
      label: 'Left'
    },
    {
      value: 'center',
      label: 'Center'
    }
  ]

  const totalItems = Array.from({ length: 6 }, (_, index) => ({
    value: index + 5,
    label: index + 5
  }))

  const shapeItems = useMemo(
    () =>
      Object.keys(RATING_SHAPE_ICONS).map(key => ({
        value: key,
        label: t(`form.builder.settings.${key}`),
        icon: RATING_SHAPE_ICONS[key]
      })),
    [t]
  )

  const handleChange = useCallback(
    (key: string, value: any) => {
      startTransition(() => {
        dispatch({
          type: 'updateField',
          payload: {
            id: field.id,
            updates: {
              properties: {
                ...field.properties,
                [key]: value
              }
            }
          }
        })
      })
    },
    [dispatch, field]
  )

  return (
    <>
      <div className="space-y-1">
        <label className="text-sm/6" htmlFor="#">
          Icon size
        </label>

        <Input
          type="number"
          min={24}
          max={96}
          placeholder="48"
          value={field.properties?.optionSize}
          onChange={value =>
            handleChange('optionSize', helper.isEmpty(value) ? undefined : Number(value))
          }
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="text-sm/6" htmlFor="#">
          {t('form.builder.settings.total')}
        </label>

        <Select
          type="number"
          options={totalItems}
          value={field.properties?.total || 5}
          onChange={value => handleChange('total', value)}
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="text-sm/6" htmlFor="#">
          Alignment
        </label>

        <Select
          value={field.properties?.optionAlignment || 'left'}
          options={alignmentItems}
          onChange={value => handleChange('optionAlignment', value)}
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="text-sm/6" htmlFor="#">
          {t('form.builder.settings.shape')}
        </label>

        <Select
          className="neptunysform-rating-shape"
          options={shapeItems}
          contentProps={{
            className: 'neptunysform-rating-shape'
          }}
          value={field.properties?.shape}
          onChange={value => handleChange('shape', value)}
        />
      </div>
    </>
  )
}
