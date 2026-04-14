import { COUNTRIES } from '@heyform-inc/form-renderer'
import { FieldLayoutAlignEnum } from '@heyform-inc/shared-types-enums'
import { IconEye, IconEyeOff, IconPlus, IconStar, IconTrash } from '@tabler/icons-react'
import { startTransition, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { cn, isRenderableImageSource } from '@/utils'

import { Button, ImagePicker, Select, Switch, Tooltip } from '@/components'

import { useStoreContext } from '../../store'
import { RequiredSettingsProps } from './Required'

function buildFullNameMode(showFirstName: boolean, showLastName: boolean) {
  if (showFirstName && showLastName) {
    return 'both'
  }

  if (showFirstName) {
    return 'first'
  }

  if (showLastName) {
    return 'last'
  }

  return 'both'
}

function ContactFieldRow({
  label,
  visible,
  required,
  onToggleVisible,
  onToggleRequired
}: {
  label: string
  visible: boolean
  required: boolean
  onToggleVisible: () => void
  onToggleRequired: () => void
}) {
  return (
    <div className="hf-card-muted flex items-center justify-between rounded-xl px-3 py-2.5">
      <span className={cn('text-sm/6 font-medium', !visible && 'text-secondary')}>
        {label}
      </span>

      <div className="flex items-center gap-1">
        <Tooltip label={visible ? 'Hide this field' : 'Show this field'}>
          <Button.Link size="sm" iconOnly className={cn(visible ? 'text-primary' : 'text-secondary')} onClick={onToggleVisible}>
            {visible ? <IconEye className="h-4 w-4" /> : <IconEyeOff className="h-4 w-4" />}
          </Button.Link>
        </Tooltip>

        <Tooltip label={required ? 'Make this field optional' : 'Make this field required'}>
          <Button.Link
            size="sm"
            iconOnly
            disabled={!visible}
            className={cn(required ? 'text-primary' : 'text-secondary')}
            onClick={onToggleRequired}
          >
            <IconStar className="h-4 w-4" />
          </Button.Link>
        </Tooltip>
      </div>
    </div>
  )
}

export default function ContactInfoSettings({ field }: RequiredSettingsProps) {
  const { t } = useTranslation()
  const { dispatch } = useStoreContext()
  const showFirstName = field.properties?.showFirstName ?? field.properties?.fullNameMode !== 'last'
  const showLastName = field.properties?.showLastName ?? field.properties?.fullNameMode !== 'first'
  const showPhoneNumber = field.properties?.showPhoneNumber ?? true
  const showEmail = field.properties?.showEmail ?? true
  const showCompany = field.properties?.showCompany ?? true
  const hasMedia = isRenderableImageSource(field.layout?.mediaUrl)
  const legacyRequired = Boolean(field.validations?.required)

  const rowConfig = useMemo(
    () => [
      {
        label: 'First name',
        visibleKey: 'showFirstName',
        requiredKey: 'firstNameRequired',
        visible: showFirstName,
        required: field.properties?.firstNameRequired ?? legacyRequired
      },
      {
        label: 'Last name',
        visibleKey: 'showLastName',
        requiredKey: 'lastNameRequired',
        visible: showLastName,
        required: field.properties?.lastNameRequired ?? legacyRequired
      },
      {
        label: 'Phone number',
        visibleKey: 'showPhoneNumber',
        requiredKey: 'phoneNumberRequired',
        visible: showPhoneNumber,
        required: field.properties?.phoneNumberRequired ?? legacyRequired
      },
      {
        label: 'Email',
        visibleKey: 'showEmail',
        requiredKey: 'emailRequired',
        visible: showEmail,
        required: field.properties?.emailRequired ?? legacyRequired
      },
      {
        label: 'Company',
        visibleKey: 'showCompany',
        requiredKey: 'companyRequired',
        visible: showCompany,
        required: field.properties?.companyRequired ?? false
      }
    ],
    [
      field.properties?.companyRequired,
      field.properties?.emailRequired,
      field.properties?.firstNameRequired,
      field.properties?.lastNameRequired,
      field.properties?.phoneNumberRequired,
      legacyRequired,
      showCompany,
      showEmail,
      showFirstName,
      showLastName,
      showPhoneNumber
    ]
  )

  const updateField = useCallback(
    (updates: Record<string, any>) => {
      dispatch({
        type: 'updateField',
        payload: {
          id: field.id,
          updates
        }
      })
    },
    [dispatch, field.id]
  )

  const updateProperties = useCallback(
    (updates: Record<string, any>) => {
      const nextProperties = {
        ...field.properties,
        ...updates
      }

      const nextShowFirstName = nextProperties.showFirstName ?? field.properties?.showFirstName ?? true
      const nextShowLastName = nextProperties.showLastName ?? field.properties?.showLastName ?? true

      nextProperties.fullNameMode = buildFullNameMode(nextShowFirstName, nextShowLastName)

      updateField({
        properties: nextProperties
      })
    },
    [field.properties, updateField]
  )

  const handleMediaChange = useCallback(
    (value: string) => {
      startTransition(() => {
        updateField({
          layout: {
            ...field.layout,
            mediaUrl: value,
            mediaType: 'image',
            brightness: field.layout?.brightness ?? 0,
            align: field.layout?.align || FieldLayoutAlignEnum.INLINE,
            inlineMediaPosition: field.layout?.inlineMediaPosition || 'bottom',
            inlineMediaWidth: field.layout?.inlineMediaWidth || 75
          }
        })
      })
    },
    [field.layout, updateField]
  )

  const handleRemoveMedia = useCallback(() => {
    updateField({
      layout: {}
    })
  }, [updateField])

  return (
    <div className="space-y-3">
      {rowConfig.map(row => (
        <ContactFieldRow
          key={row.label}
          label={row.label}
          visible={row.visible}
          required={row.required}
          onToggleVisible={() => updateProperties({ [row.visibleKey]: !row.visible })}
          onToggleRequired={() => updateProperties({ [row.requiredKey]: !row.required })}
        />
      ))}

      {showPhoneNumber && (
        <div className="space-y-1">
          <label className="text-sm/6">Default country</label>

          <Select
            className="w-full"
            options={COUNTRIES}
            value={field.properties?.defaultCountryCode || 'US'}
            multiLanguage
            onChange={value => updateProperties({ defaultCountryCode: value })}
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <label className="text-sm/6">Map to contacts</label>

        <Switch
          value={field.properties?.mapToContacts}
          onChange={value => updateProperties({ mapToContacts: value })}
        />
      </div>

      <div className="hf-card-muted flex items-center justify-between rounded-xl px-3 py-2.5">
        <span className="text-sm/6 font-medium">Image or video</span>

        <div className="flex items-center gap-1">
          <ImagePicker tabs={['image', 'unsplash']} onChange={handleMediaChange}>
            <Button.Link size="sm" iconOnly className="text-primary">
              <IconPlus className="h-4 w-4" />
            </Button.Link>
          </ImagePicker>

          {hasMedia && (
            <Tooltip label={t('components.remove')}>
              <Button.Link size="sm" iconOnly className="text-secondary" onClick={handleRemoveMedia}>
                <IconTrash className="h-4 w-4" />
              </Button.Link>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  )
}