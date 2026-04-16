import { useRequest } from 'ahooks'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { TIMEZONES } from '@/consts/date'
import { WorkspaceService } from '@/services'
import { getTimeZone, useParam } from '@/utils'
import { helper } from '@heyform-inc/utils'

import { Button, Form, Input, Select, Switch, useToast } from '@/components'
import { useWorkspaceStore } from '@/store'
import { WorkspaceLeadFlowType } from '@/types'

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

export default function WorkspaceLeadFlow() {
  const { t } = useTranslation()
  const { workspaceId } = useParam()
  const { workspace, updateWorkspace } = useWorkspaceStore()
  const toast = useToast()
  const [leadFlowForm] = Form.useForm()

  const { data, refreshAsync } = useRequest(
    async () => WorkspaceService.leadFlow(workspaceId),
    {
      refreshDeps: [workspaceId]
    }
  )

  const leadFlow = data as WorkspaceLeadFlowType | undefined

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
      leadNotificationEmailsText: (leadFlow?.leadNotificationEmails ?? workspace?.leadNotificationEmails ?? []).join('\n')
    }),
    [leadFlow, workspace?.clientName, workspace?.enableLeadReport, workspace?.leadNotificationEmails, workspace?.leadReportRangeDays, workspace?.reportingTimezone]
  )

  function normalizeLeadFlowValues(values: AnyMap) {
    return {
      clientName: helper.isValid(values.clientName) ? values.clientName.trim() : undefined,
      enableLeadReport: Boolean(values.enableLeadReport),
      leadReportRangeDays: helper.isValid(values.leadReportRangeDays)
        ? Number(values.leadReportRangeDays)
        : undefined,
      reportingTimezone: helper.isValid(values.reportingTimezone)
        ? values.reportingTimezone
        : undefined,
      leadNotificationEmails: parseEmailList(values.leadNotificationEmailsText)
    }
  }

  async function fetch(values: AnyMap) {
    const updates = normalizeLeadFlowValues(values)

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

  const { loading: sendReportLoading, runAsync: runSendReportAsync } = useRequest(
    async () => {
      const values = leadFlowForm.getFieldsValue(true)
      const updates = normalizeLeadFlowValues(values)

      if (updates.leadNotificationEmails.length < 1) {
        throw new Error('Add at least one default lead recipient before sending a report')
      }

      await WorkspaceService.sendLeadReport(workspaceId, updates)
    },
    {
      manual: true
    }
  )

  async function handleSendReportNow() {
    try {
      await runSendReportAsync()
      toast({
        title: 'Workspace report sent',
        message:
          'A workspace lead report was sent to the current default recipients using the values shown here.'
      })
    } catch (error: any) {
      toast({
        title: t('components.error.title'),
        message: error.message || 'Unable to send the workspace report right now.',
        duration: 7000
      })
    }
  }

  if (!leadFlow) {
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
          form={leadFlowForm}
          className="space-y-6"
          initialValues={initialValues}
          fetch={fetch}
          refreshDeps={[workspaceId, leadFlow?.leadReportLastSentAt]}
          submitProps={{
            label: 'Save lead defaults',
            className: 'w-full sm:w-auto'
          }}
          submitOnChangedOnly
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
            footer="Included in operator alerts so downstream teams know which account the lead belongs to."
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

          <div className="space-y-3 rounded-2xl border border-accent-light p-5">
            <div>
              <h3 className="text-base font-semibold">Send on demand</h3>
              <p className="text-secondary mt-1 text-sm/6">
                Send the workspace lead report immediately to the default recipients using the values currently shown here, even if you have not saved them yet. This does not reset the next scheduled report.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button.Ghost size="md" loading={sendReportLoading} onClick={handleSendReportNow}>
                Send report now
              </Button.Ghost>
            </div>
          </div>
        </Form.Simple>
      </div>
    </section>
  )
}