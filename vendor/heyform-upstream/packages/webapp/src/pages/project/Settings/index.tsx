import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { TIMEZONES } from '@/consts/date'
import { ProjectService } from '@/services'
import { useWorkspaceStore } from '@/store'
import { getTimeZone, useParam } from '@/utils'
import { helper } from '@heyform-inc/utils'

import { Form, Input, Select, Switch, useToast } from '@/components'

function parseEmailList(rawValue?: string) {
  const value = rawValue || ''

  if (!helper.isValid(value)) {
    return []
  }

  return Array.from(
    new Set(
      value
        .split(/[\n,;]+/)
        .map(part => part.trim())
        .filter(Boolean)
    )
  )
}

export default function ProjectSettings() {
  const { t } = useTranslation()
  const { workspaceId, projectId } = useParam()
  const { project, workspace, updateProject } = useWorkspaceStore()
  const toast = useToast()

  const timezoneOptions = useMemo(
    () =>
      TIMEZONES.map(timezone => ({
        value: timezone.value,
        label: `(GMT${timezone.gmt}) ${t(timezone.label)}`
      })),
    [t]
  )

  const workspaceDefaultRangeDays = workspace?.leadReportRangeDays ?? 30
  const workspaceDefaultTimezone = workspace?.reportingTimezone ?? getTimeZone()

  const initialValues = useMemo(
    () => ({
      enableLeadReport: Boolean(project?.enableLeadReport),
      leadReportRangeDays: project?.leadReportRangeDays,
      reportingTimezone: project?.reportingTimezone,
      leadNotificationEmailsText: (project?.leadNotificationEmails || []).join('\n')
    }),
    [project]
  )

  async function saveProjectSettings(values: AnyMap) {
    const notificationEmails = parseEmailList(values.leadNotificationEmailsText)

    await ProjectService.update(projectId, {
      enableLeadReport: Boolean(values.enableLeadReport),
      leadReportRangeDays: helper.isValid(values.leadReportRangeDays)
        ? Number(values.leadReportRangeDays)
        : null,
      reportingTimezone: helper.isValid(values.reportingTimezone) ? values.reportingTimezone : '',
      leadNotificationEmails: notificationEmails.length > 0 ? notificationEmails : null
    })

    updateProject(workspaceId, projectId, {
      enableLeadReport: Boolean(values.enableLeadReport),
      leadReportRangeDays: helper.isValid(values.leadReportRangeDays)
        ? Number(values.leadReportRangeDays)
        : undefined,
      reportingTimezone: helper.isValid(values.reportingTimezone) ? values.reportingTimezone : undefined,
      leadNotificationEmails: notificationEmails.length > 0 ? notificationEmails : undefined
    })

    toast({
      title: 'Project settings updated',
      message: 'Project lead routing and reporting defaults were saved.'
    })
  }

  return (
    <div className="mt-6">
      <section>
        <div className="max-w-3xl">
          <h2 className="hf-section-title">Project settings</h2>
          <p data-slot="text" className="text-secondary mt-4 text-base/5 sm:text-sm/6">
            Override workspace lead routing and reporting defaults for this project. Leave a field
            blank to keep inheriting the workspace value.
          </p>
        </div>

        <div className="mt-6 max-w-3xl">
          <Form.Simple
            key={`${projectId}:${JSON.stringify(initialValues)}`}
            className="space-y-6"
            initialValues={initialValues}
            fetch={saveProjectSettings}
            refreshDeps={[projectId, project?.leadReportLastSentAt]}
            submitProps={{
              label: 'Save project settings',
              className: 'w-full sm:w-auto'
            }}
            submitOnChangedOnly
          >
            <div className="space-y-6 rounded-2xl border border-accent-light p-5">
              <Form.Item
                className="[&_[data-slot=content]]:pt-1.5"
                name="enableLeadReport"
                label="Monthly project report"
                description="Send a scheduled project-level digest using project recipients when provided, otherwise the workspace defaults."
                isInline
              >
                <Switch />
              </Form.Item>

              <Form.Item
                name="leadReportRangeDays"
                label="Report lookback window (days)"
                footer={
                  project?.leadReportLastSentAt
                    ? `Last project digest: ${new Date(project.leadReportLastSentAt * 1000).toLocaleString()}`
                    : `Leave blank to use the workspace default of ${workspaceDefaultRangeDays} days.`
                }
              >
                <Input type="number" min={1} max={365} placeholder={String(workspaceDefaultRangeDays)} />
              </Form.Item>

              <Form.Item
                name="reportingTimezone"
                label="Reporting timezone"
                footer={`Leave blank to inherit the workspace timezone (${workspaceDefaultTimezone}).`}
              >
                <Select
                  className="w-full"
                  allowClear
                  placeholder="Inherit workspace timezone"
                  options={timezoneOptions}
                  contentProps={{
                    position: 'popper'
                  }}
                />
              </Form.Item>

              <Form.Item
                name="leadNotificationEmailsText"
                label="Project lead recipients"
                footer={
                  helper.isValidArray(workspace?.leadNotificationEmails)
                    ? 'Leave blank to inherit the workspace default recipients.'
                    : 'Add one email address per line for project-specific routing.'
                }
              >
                <Input.TextArea rows={5} placeholder={'campaign@example.com\nops@example.com'} />
              </Form.Item>
            </div>
          </Form.Simple>
        </div>
      </section>
    </div>
  )
}