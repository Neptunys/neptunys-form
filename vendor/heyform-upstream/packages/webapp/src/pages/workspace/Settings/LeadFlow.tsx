import { useRequest } from 'ahooks'
import { IconAlertCircle, IconCheck } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { TIMEZONES } from '@/consts/date'
import { AppService, WorkspaceService } from '@/services'
import { getTimeZone, useParam } from '@/utils'
import { helper } from '@heyform-inc/utils'

import { Form, Input, Select, Switch } from '@/components'
import IntegrationSettingsItem from '@/pages/form/Integrations/IntegrationSettingsItem'
import { useWorkspaceStore } from '@/store'
import { AppType, WorkspaceLeadFlowType } from '@/types'

function parseEmailList(rawValue?: string) {
  const value = rawValue || ''

  if (!helper.isValid(value)) {
    return []
  }

  return Array.from(
    new Set(
      value
        .split(/[\n,;]+/)
        .map(value => value.trim())
        .filter(Boolean)
    )
  )
}

function getGoogleSheetsInitialValues(
  app: AppType | undefined,
  leadFlow?: WorkspaceLeadFlowType
) {
  const defaults = (app?.settings || []).reduce((values, setting) => {
    if (setting.defaultValue !== undefined) {
      values[setting.name] = setting.defaultValue
    }

    return values
  }, {} as AnyMap)

  return {
    ...defaults,
    ...(leadFlow?.googleSheetsLeadConfig || {})
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

export default function WorkspaceLeadFlow() {
  const { t } = useTranslation()
  const { workspaceId } = useParam()
  const { workspace, updateWorkspace } = useWorkspaceStore()
  const [googleSheetsEnabled, setGoogleSheetsEnabled] = useState(false)

  const { data, refreshAsync } = useRequest(
    async () => {
      const [leadFlow, apps] = await Promise.all([
        WorkspaceService.leadFlow(workspaceId),
        AppService.apps()
      ])

      return {
        leadFlow,
        googleSheetsApp: apps.find((app: AppType) => app.id === 'googlesheets')
      }
    },
    {
      refreshDeps: [workspaceId]
    }
  )

  const leadFlow = data?.leadFlow
  const googleSheetsApp = data?.googleSheetsApp

  const timezoneOptions = TIMEZONES.map(timezone => ({
    value: timezone.value,
    label: `(GMT${timezone.gmt}) ${t(timezone.label)}`
  }))

  const initialValues = useMemo(
    () => ({
      clientName: leadFlow?.clientName ?? workspace?.clientName ?? '',
      enableLeadReport: leadFlow?.enableLeadReport ?? workspace?.enableLeadReport ?? false,
      leadReportRangeDays: leadFlow?.leadReportRangeDays ?? workspace?.leadReportRangeDays ?? 30,
      reportingTimezone: leadFlow?.reportingTimezone ?? workspace?.reportingTimezone ?? getTimeZone(),
      leadNotificationEmailsText: (leadFlow?.leadNotificationEmails ?? workspace?.leadNotificationEmails ?? []).join('\n'),
      enableGoogleSheetsLeadSync: leadFlow?.enableGoogleSheetsLeadSync ?? false,
      ...getGoogleSheetsInitialValues(googleSheetsApp, leadFlow)
    }),
    [googleSheetsApp, leadFlow, workspace?.clientName, workspace?.enableLeadReport, workspace?.leadNotificationEmails, workspace?.leadReportRangeDays, workspace?.reportingTimezone]
  )

  const deliverySummary = useMemo(() => {
    if (!leadFlow?.googleSheetsLeadLastDeliveryStatus || !leadFlow.googleSheetsLeadLastDeliveryAt) {
      return null
    }

    const deliveredAt = new Date(leadFlow.googleSheetsLeadLastDeliveryAt * 1000).toLocaleString()
    const failed = leadFlow.googleSheetsLeadLastDeliveryStatus === 'error'

    return {
      failed,
      text: failed ? `Last workspace sync failed · ${deliveredAt}` : `Last workspace sync succeeded · ${deliveredAt}`,
      message: leadFlow.googleSheetsLeadLastDeliveryMessage
    }
  }, [leadFlow?.googleSheetsLeadLastDeliveryAt, leadFlow?.googleSheetsLeadLastDeliveryMessage, leadFlow?.googleSheetsLeadLastDeliveryStatus])

  useEffect(() => {
    setGoogleSheetsEnabled(Boolean(initialValues.enableGoogleSheetsLeadSync))
  }, [initialValues.enableGoogleSheetsLeadSync])

  async function fetch(values: AnyMap) {
    const updates = {
      clientName: helper.isValid(values.clientName) ? values.clientName.trim() : undefined,
      enableLeadReport: Boolean(values.enableLeadReport),
      leadReportRangeDays: helper.isValid(values.leadReportRangeDays)
        ? Number(values.leadReportRangeDays)
        : undefined,
      reportingTimezone: helper.isValid(values.reportingTimezone)
        ? values.reportingTimezone
        : undefined,
      leadNotificationEmails: parseEmailList(values.leadNotificationEmailsText),
      enableGoogleSheetsLeadSync: Boolean(values.enableGoogleSheetsLeadSync),
      googleSheetsLeadConfig: values.enableGoogleSheetsLeadSync
        ? buildGoogleSheetsConfig(googleSheetsApp, values)
        : leadFlow?.googleSheetsLeadConfig || {}
    }

    updateWorkspace(workspaceId, {
      clientName: updates.clientName,
      enableLeadReport: updates.enableLeadReport,
      leadReportRangeDays: updates.leadReportRangeDays,
      reportingTimezone: updates.reportingTimezone,
      leadNotificationEmails: updates.leadNotificationEmails
    })
    await WorkspaceService.update(workspaceId, updates)
    await refreshAsync()
  }

  if (!leadFlow || !googleSheetsApp) {
    return (
      <section id="lead-flow" className="border-accent-light border-b py-10">
        <h2 className="hf-section-title">Lead routing and reporting</h2>

        <div className="mt-4 max-w-3xl">
          <p data-slot="text" className="text-secondary text-base/5 sm:text-sm/5">
            Loading workspace lead defaults...
          </p>
        </div>
      </section>
    )
  }

  return (
    <section id="lead-flow" className="border-accent-light border-b py-10">
      <h2 className="hf-section-title">Lead routing and reporting</h2>

      <div className="mt-4 max-w-3xl space-y-4">
        <p data-slot="text" className="text-secondary text-base/5 sm:text-sm/5">
          Configure workspace-wide client metadata, default lead recipients, and the timezone used for operator alerts and the monthly lead digest.
        </p>

        <Form.Simple
          key={`${workspaceId}:${JSON.stringify(initialValues)}`}
          className="space-y-6"
          initialValues={initialValues}
          fetch={fetch}
          refreshDeps={[workspaceId, leadFlow?.googleSheetsLeadLastDeliveryAt, leadFlow?.leadReportLastSentAt]}
          submitProps={{
            label: 'Save lead defaults',
            className: 'w-full sm:w-auto'
          }}
          submitOnChangedOnly
          onValuesChange={(_changedValues, values) => {
            setGoogleSheetsEnabled(Boolean(values.enableGoogleSheetsLeadSync))
          }}
        >
          <Form.Item
            className="[&_[data-slot=content]]:pt-1.5"
            name="enableLeadReport"
            label="Monthly lead report"
            description="Send a scheduled workspace lead digest to the default recipients on the first day of each month at 09:00 in the reporting timezone."
            isInline
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="clientName"
            label="Client name"
            footer="Included in operator alerts and Google Sheets rows so downstream teams know which account the lead belongs to."
          >
            <Input placeholder="Acme Defense" />
          </Form.Item>

          <Form.Item
            name="leadReportRangeDays"
            label="Report lookback window (days)"
            footer={
              workspace?.leadReportLastSentAt
                ? `Last sent: ${new Date(workspace.leadReportLastSentAt * 1000).toLocaleString()}`
                : 'Controls the date range summarized in the monthly lead digest.'
            }
          >
            <Input type="number" min={1} max={365} placeholder="30" />
          </Form.Item>

          <Form.Item
            name="reportingTimezone"
            label="Reporting timezone"
            footer="Used to label lead and reporting context consistently across operator alerts and downstream destinations."
          >
            <Select
              className="w-full"
              allowClear
              placeholder="Select a timezone"
              options={timezoneOptions}
              contentProps={{
                position: 'popper'
              }}
            />
          </Form.Item>

          <Form.Item
            name="leadNotificationEmailsText"
            label="Default lead recipients"
            footer="One email address per line. These recipients are used for monthly workspace reports and are appended to per-form operator recipients when operator notifications are enabled."
          >
            <Input.TextArea rows={5} placeholder={'sales@example.com\nrevops@example.com'} />
          </Form.Item>

          <div className="border-accent-light border-t pt-6">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Workspace Google Sheets</h3>
              <p className="text-secondary text-sm/6">
                Mirror submissions from every form in this workspace into a shared Google Sheets destination, using the same lead scoring, routing, and mapping options as the form-level integration.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <Form.Item
                className="[&_[data-slot=content]]:pt-1.5"
                name="enableGoogleSheetsLeadSync"
                label="Workspace-wide Google Sheets sync"
                description="When enabled, every submission in this workspace is queued to the shared Google Sheets destination in addition to any form-specific integrations."
                isInline
              >
                <Switch />
              </Form.Item>

              {deliverySummary && (
                <div data-status={deliverySummary.failed ? 'error' : 'success'}>
                  <div
                    className={deliverySummary.failed ? 'text-error flex items-center gap-x-2' : 'text-brand flex items-center gap-x-2'}
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

              {googleSheetsEnabled && (
                <div className="space-y-4 rounded-2xl border border-zinc-200/70 p-5">
                  <div className="space-y-1">
                    <div className="font-medium">{googleSheetsApp.name}</div>
                    <p className="text-secondary text-sm/6">{googleSheetsApp.description}</p>
                  </div>

                  {googleSheetsApp.settings?.map(setting => (
                    <IntegrationSettingsItem key={setting.name} setting={setting} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </Form.Simple>
      </div>
    </section>
  )
}