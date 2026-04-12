import { startTransition, useCallback } from 'react'

import { Input } from '@/components'

import { useStoreContext } from '../../store'
import { RequiredSettingsProps } from './Required'

export default function LegalTermsSettings({ field }: RequiredSettingsProps) {
  const { dispatch } = useStoreContext()

  const handleChange = useCallback(
    (key: string, value: any) => {
      const normalizedValue =
        typeof value === 'string' ? value.trim() || undefined : value

      startTransition(() => {
        dispatch({
          type: 'updateField',
          payload: {
            id: field.id,
            updates: {
              properties: {
                ...field.properties,
                [key]: normalizedValue
              }
            }
          }
        })
      })
    },
    [dispatch, field.id, field.properties]
  )

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="text-sm/6">Consent label</div>
        <Input
          placeholder="I agree to the terms and privacy policy."
          value={field.properties?.consentText}
          onChange={value => handleChange('consentText', value)}
        />
      </div>

      <div className="space-y-1">
        <div className="text-sm/6">Button label</div>
        <Input
          placeholder="Continue"
          value={field.properties?.buttonText}
          onChange={value => handleChange('buttonText', value)}
        />
      </div>
    </div>
  )
}