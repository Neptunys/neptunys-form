import { FormRenderer } from '@neptunysform-inc/form-renderer/src'
import { FC, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getFilteredFields } from '../utils'
import { useStoreContext } from '../store'
import { cn } from '@/utils'

import { Modal, Tabs } from '@/components'
import { useFormStore, useModal } from '@/store'

interface PreviewComponentProps {
  onClose: () => void
}

const PreviewComponent: FC<PreviewComponentProps> = () => {
  const { t } = useTranslation()

  const { form: rawForm, tempSettings, themeSettings } = useFormStore()
  const { state } = useStoreContext()
  const [platform, setPlatform] = useState('mobile')
  const previewFields = useMemo(() => getFilteredFields(state.fields || []).fields, [state.fields])

  const form: any = useMemo(
    () => ({
      ...rawForm,
      themeSettings: {
        ...rawForm?.themeSettings,
        ...themeSettings,
        theme: themeSettings?.theme || rawForm?.themeSettings?.theme
      },
      drafts: previewFields,
      fields: previewFields,
      hiddenFields: state.hiddenFields || rawForm?.hiddenFields || [],
      logics: state.logics || rawForm?.logics || [],
      variables: state.variables || rawForm?.variables || [],
      settings: {
        ...rawForm?.settings,
        ...tempSettings,
        locale: state.locale || rawForm?.settings?.locale,
        whitelabelBranding: true
      }
    }),
    [
      previewFields,
      rawForm,
      state.hiddenFields,
      state.locale,
      state.logics,
      state.variables,
      tempSettings,
      themeSettings
    ]
  )

  const tabs = useMemo(
    () => [
      {
        value: 'desktop',
        label: t('form.builder.preview.desktop')
      },
      {
        value: 'mobile',
        label: t('form.builder.preview.mobile')
      }
    ],
    [t]
  )

  return (
    <div className="builder-preview-modal flex h-full w-full flex-col overflow-hidden px-2 pb-2">
      <div className="flex h-14 items-center justify-center">
        <Tabs.SegmentedControl
          className="hidden sm:flex [&_[data-slot=nav]]:h-9 [&_[data-slot=tablist]_button]:py-0.5"
          tabs={tabs}
          defaultTab={platform}
          onChange={setPlatform}
        />
      </div>

      <div className="builder-preview-surface bg-foreground lg:ring-primary/5 h-[calc(100%-4rem)] overflow-hidden lg:rounded-lg lg:shadow-sm lg:ring-1">
        <div className={cn('form-preview relative h-full w-full', `form-preview-${platform}`)}>
          {/* Regression guard: renderer must be scoped to this viewport, never to window dimensions. */}
          <div className="form-preview-viewport" data-slot="preview-viewport">
            <div className="form-preview-renderer" data-slot="preview-renderer">
              <FormRenderer
                form={form}
                autoSave={false}
                query={{}}
                locale={form?.settings?.locale || 'en'}
                alwaysShowNextButton={!form?.settings?.autoAdvanceSingleChoice}
                enableQuestionList={form?.settings?.enableQuestionList}
                enableNavigationArrows={form?.settings?.enableNavigationArrows}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PreviewModal() {
  const { isOpen, onOpenChange } = useModal('PreviewModal')

  return (
    <Modal
      open={isOpen}
      overlayProps={{
        className: 'bg-transparent'
      }}
      contentProps={{
        className:
          'max-w-screen max-h-screen !overflow-hidden w-screen h-screen bg-foreground p-0 bg-background focus:outline-none focus-visible:outline-none'
      }}
      onOpenChange={onOpenChange}
    >
      <PreviewComponent onClose={() => onOpenChange(false)} />
    </Modal>
  )
}
