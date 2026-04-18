import { useEffect, useMemo, useState } from 'react'
import { useRequest } from 'ahooks'
import { IconAlertCircle, IconCheck } from '@tabler/icons-react'

import { AppService, ProjectService } from '@/services'
import { Button, Form, Switch, useToast } from '@/components'
import IntegrationSettingsItem, { getVisibleIntegrationSettings } from '@/pages/form/Integrations/IntegrationSettingsItem'
import { useParam } from '@/utils'
import { AppType } from '@/types'
import { helper } from '@heyform-inc/utils'

interface ProjectLeadFlowType {
  enableGoogleSheetsLeadSync?: boolean
  googleSheetsLeadConfig?: AnyMap
  googleSheetsLeadLastDeliveryAt?: number
  googleSheetsLeadLastDeliveryStatus?: string
  googleSheetsLeadLastDeliveryMessage?: string
}

function getGoogleSheetsInitialValues(app: AppType | undefined, values?: AnyMap) {
  const defaults = (app?.settings || []).reduce((result, setting) => {
    if (setting.defaultValue !== undefined) {
      result[setting.name] = setting.defaultValue
    }

    return result
  }, {} as AnyMap)

  return {
    enableGoogleSheetsLeadSync: false,
    ...defaults,
    ...(values || {})
  }
}

function buildGoogleSheetsConfig(app: AppType | undefined, values: AnyMap) {
  return (app?.settings || []).reduce((config, setting) => {
    const value = values[setting.name]

    if (setting.type === 'switch') {
      if (value === true) {
        config[setting.name] = true
      }

      return config
    }

    if (helper.isValid(value)) {
      config[setting.name] = value
    }

    return config
  }, {} as AnyMap)
}

export default function ProjectGoogleSheets() {
  const { projectId } = useParam()
  const toast = useToast()
  const [googleSheetsForm] = Form.useForm()
  const [enabled, setEnabled] = useState(false)
  const [draftValues, setDraftValues] = useState<AnyMap>({})

  const {
    data,
    error,
    loading,
    refreshAsync
  } = useRequest(
    async () => {
      const [apps, leadFlow] = await Promise.all([
        AppService.apps(),
        ProjectService.leadFlow(projectId)
      ])

      return {
        googleSheetsApp: apps.find((app: AppType) => app.id === 'googlesheets'),
        leadFlow
      }
    },
    {
      refreshDeps: [projectId]
    }
  )

  const googleSheetsApp = data?.googleSheetsApp
  const leadFlow = data?.leadFlow as ProjectLeadFlowType | undefined

  const { loading: testLoading, runAsync: runTestAsync } = useRequest(
    (values: AnyMap) => ProjectService.testGoogleSheets(projectId, buildGoogleSheetsConfig(googleSheetsApp, values)),
    {
      manual: true
    }
  )

  const initialValues = useMemo(
    () =>
      getGoogleSheetsInitialValues(googleSheetsApp, {
        enableGoogleSheetsLeadSync: Boolean(leadFlow?.enableGoogleSheetsLeadSync),
        ...(leadFlow?.googleSheetsLeadConfig || {})
      }),
    [googleSheetsApp, leadFlow?.enableGoogleSheetsLeadSync, leadFlow?.googleSheetsLeadConfig]
  )

  const deliverySummary = useMemo(() => {
    if (!leadFlow?.googleSheetsLeadLastDeliveryStatus || !leadFlow.googleSheetsLeadLastDeliveryAt) {
      return null
    }

    const deliveredAt = new Date(leadFlow.googleSheetsLeadLastDeliveryAt * 1000).toLocaleString()
    const failed = leadFlow.googleSheetsLeadLastDeliveryStatus === 'error'

    return {
      failed,
      text: failed ? `Last project sync failed · ${deliveredAt}` : `Last project sync succeeded · ${deliveredAt}`,
      message: leadFlow.googleSheetsLeadLastDeliveryMessage
    }
  }, [leadFlow?.googleSheetsLeadLastDeliveryAt, leadFlow?.googleSheetsLeadLastDeliveryMessage, leadFlow?.googleSheetsLeadLastDeliveryStatus])

  useEffect(() => {
    const nextEnabled = Boolean(initialValues.enableGoogleSheetsLeadSync)

    setEnabled(nextEnabled)
    setDraftValues(initialValues)
  }, [initialValues])

  async function saveProjectGoogleSheets(values: AnyMap) {
    const enableGoogleSheetsLeadSync = Boolean(values.enableGoogleSheetsLeadSync)
    const googleSheetsLeadConfig = enableGoogleSheetsLeadSync
      ? buildGoogleSheetsConfig(googleSheetsApp, values)
      : null

    await ProjectService.update(projectId, {
      enableGoogleSheetsLeadSync,
      googleSheetsLeadConfig
    })

    setEnabled(enableGoogleSheetsLeadSync)

    await refreshAsync()

    toast({
      title: 'Project Google Sheets updated',
      message: 'Project-wide Google Sheets sync settings were saved.'
    })
  }

  async function handleTest(values: AnyMap) {
    try {
      const enableGoogleSheetsLeadSync = Boolean(values.enableGoogleSheetsLeadSync)

      if (!enableGoogleSheetsLeadSync) {
        throw new Error('Enable project Google Sheets sync before sending a sample lead set')
      }

      await runTestAsync(values)
      await refreshAsync()

      toast({
        title: 'Sample lead set sent',
        message: 'Sample leads were written to the project leads sheet and linked Lead Answers sheet with one answers row per lead.'
      })
    } catch (testError: any) {
      toast({
        title: 'Sample lead set failed',
        message: testError.message,
        duration: 7000
      })
    }
  }

  if (loading) {
    return (
      <div className="mt-6">
        <section>
          <div className="max-w-3xl">
            <h2 className="hf-section-title">Project Google Sheets</h2>
            <p data-slot="text" className="text-secondary mt-4 text-base/5 sm:text-sm/6">
              Loading Google Sheets settings...
            </p>
          </div>
        </section>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mt-6">
        <section>
          <div className="max-w-3xl">
            <h2 className="hf-section-title">Project Google Sheets</h2>
            <p data-slot="text" className="text-error mt-4 text-base/5 sm:text-sm/6">
              {error.message}
            </p>
          </div>
        </section>
      </div>
    )
  }

  if (!googleSheetsApp || !leadFlow) {
    return (
      <div className="mt-6">
        <section>
          <div className="max-w-3xl">
            <h2 className="hf-section-title">Project Google Sheets</h2>
            <p data-slot="text" className="text-error mt-4 text-base/5 sm:text-sm/6">
              Google Sheets settings are unavailable for this project right now.
            </p>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="mt-6">
      <section>
        <div className="max-w-3xl">
          <h2 className="hf-section-title">Project Google Sheets</h2>
          <p data-slot="text" className="text-secondary mt-4 text-base/5 sm:text-sm/6">
            Send submissions from every form in this project into one shared Google Sheets leads sheet with a linked answers tab that keeps one row per lead.
          </p>
        </div>

        <div className="mt-6 max-w-3xl">
          <Form.Simple
            key={`${projectId}:${JSON.stringify(initialValues)}`}
            form={googleSheetsForm}
            className="space-y-6"
            initialValues={initialValues}
            fetch={saveProjectGoogleSheets}
            refreshDeps={[projectId, leadFlow?.googleSheetsLeadLastDeliveryAt]}
            submitProps={{
              label: 'Save Google Sheets',
              className: 'w-full sm:w-auto'
            }}
            submitOnChangedOnly
            onValuesChange={(_changedValues, values) => {
              setEnabled(Boolean(values.enableGoogleSheetsLeadSync))
              setDraftValues(values)
            }}
          >
            <div className="space-y-6 rounded-2xl border border-accent-light p-5">
              <Form.Item
                className="[&_[data-slot=content]]:pt-1.5"
                name="enableGoogleSheetsLeadSync"
                label="Project-wide Google Sheets sync"
                description="When enabled, every submission in this project is queued to the shared Google Sheets leads sheet and linked answers tab with one answers row per lead, in addition to any form-specific integrations."
                isInline
              >
                <Switch />
              </Form.Item>

              {deliverySummary && (
                <div data-status={deliverySummary.failed ? 'error' : 'success'}>
                  <div
                    className={
                      deliverySummary.failed
                        ? 'text-error flex items-center gap-x-2'
                        : 'text-brand flex items-center gap-x-2'
                    }
                  >
                    {deliverySummary.failed ? (
                      <IconAlertCircle className="h-4 w-4" />
                    ) : (
                      <IconCheck className="h-4 w-4" />
                    )}
                    <span>{deliverySummary.text}</span>
                  </div>

                  {helper.isValid(deliverySummary.message) && (
                    <div className="text-secondary mt-1 text-xs leading-5">
                      {deliverySummary.message}
                    </div>
                  )}
                </div>
              )}

              {enabled && (
                <div className="space-y-4 rounded-2xl border border-zinc-200/70 p-5">
                  <div className="space-y-1">
                    <div className="font-medium">{googleSheetsApp.name}</div>
                    <p className="text-secondary text-sm/6">{googleSheetsApp.description}</p>
                  </div>

                  {getVisibleIntegrationSettings(googleSheetsApp.id, googleSheetsApp.settings, draftValues).map(setting => (
                    <IntegrationSettingsItem key={setting.name} setting={setting} />
                  ))}

                  <div className="flex justify-end">
                    <Button.Ghost
                      className="w-full sm:w-auto"
                      loading={testLoading}
                      onClick={() => void handleTest(googleSheetsForm.getFieldsValue(true) || draftValues)}
                    >
                      Send sample lead set
                    </Button.Ghost>
                  </div>
                </div>
              )}
            </div>
          </Form.Simple>
        </div>
      </section>
    </div>
  )
}