import { useEffect, useMemo, useState } from 'react'
import { useRequest } from 'ahooks'
import { useTranslation } from 'react-i18next'

import { TIMEZONES } from '@/consts/date'
import { Button, Form, Input, Select, Switch, useToast } from '@/components'
import { ProjectService } from '@/services'
import { useWorkspaceStore } from '@/store'
import { ProjectLeadFlowType } from '@/types'
import { getTimeZone, useParam } from '@/utils'
import { helper } from '@heyform-inc/utils'

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

const REPORT_FREQUENCY_OPTIONS = [
  {
    label: 'Once a day',
    value: 'daily'
  },
  {
    label: 'Once a week',
    value: 'weekly'
  },
  {
    label: 'Once every 2 weeks',
    value: 'biweekly'
  },
  {
    label: 'Once a month',
    value: 'monthly'
  }
]

const confirmationTemplateFooter =
  'Supported tokens: {formName}, {projectName}, {workspaceName}, {respondentName}, {respondentEmail}, {respondentPhone}, {leadScore}, {leadResult}, {leadQuality}, {leadPriority}, {submittedAt}, {submissionId}. {leadResult} becomes negative when any selected scored answer has a score of 0.'

const recapTemplateFooter =
  'Supported tokens: {projectName}, {workspaceName}, {clientName}, {leadCount}, {startDate}, {endDate}, {dateRange}, {reportingTimezone}, {frequencyLabel}, {activeFormCount}, {formsWithLeadsCount}, {averageScore}, {highLeadCount}, {mediumLeadCount}, {lowLeadCount}, {lastReportAt}.'

export default function ProjectEmail() {
  const { t } = useTranslation()
  const { workspaceId, projectId } = useParam()
  const { project, workspace, updateProject } = useWorkspaceStore()
  const toast = useToast()
  const [emailForm] = Form.useForm()
  const [testKind, setTestKind] = useState<'confirmation' | 'negative_confirmation' | 'recap' | null>(null)

  const { data, error, loading, refreshAsync } = useRequest(
    async () => ProjectService.leadFlow(projectId),
    {
      refreshDeps: [projectId]
    }
  )

  const leadFlow = data as ProjectLeadFlowType | undefined
  const timezoneOptions = useMemo(
    () =>
      TIMEZONES.map(timezone => ({
        value: timezone.value,
        label: `(GMT${timezone.gmt}) ${t(timezone.label)}`
      })),
    [t]
  )
  const initialValues = useMemo(
    () => ({
      enableRespondentNotification: Boolean(leadFlow?.enableRespondentNotification),
      respondentNotificationSubject: leadFlow?.respondentNotificationSubject ?? '',
      respondentNotificationMessage: leadFlow?.respondentNotificationMessage ?? '',
      respondentNegativeNotificationSubject: leadFlow?.respondentNegativeNotificationSubject ?? '',
      respondentNegativeNotificationMessage: leadFlow?.respondentNegativeNotificationMessage ?? '',
      enableLeadReport: Boolean(leadFlow?.enableLeadReport),
      leadReportEmailsText: (leadFlow?.leadReportEmails || []).join('\n'),
      leadReportFrequency: leadFlow?.leadReportFrequency ?? 'monthly',
      leadReportRangeDays: leadFlow?.leadReportRangeDays ?? workspace?.leadReportRangeDays ?? 30,
      reportingTimezone: leadFlow?.reportingTimezone ?? workspace?.reportingTimezone ?? getTimeZone(),
      leadReportSubject: leadFlow?.leadReportSubject ?? '',
      leadReportMessage: leadFlow?.leadReportMessage ?? '',
      testRecipientEmail:
        leadFlow?.leadReportEmails?.[0] ||
        project?.leadNotificationEmails?.[0] ||
        workspace?.leadNotificationEmails?.[0] ||
        ''
    }),
    [
      leadFlow?.enableLeadReport,
      leadFlow?.enableRespondentNotification,
      leadFlow?.leadReportEmails,
      leadFlow?.leadReportFrequency,
      leadFlow?.leadReportMessage,
      leadFlow?.leadReportRangeDays,
      leadFlow?.leadReportSubject,
      leadFlow?.reportingTimezone,
      leadFlow?.respondentNegativeNotificationMessage,
      leadFlow?.respondentNegativeNotificationSubject,
      leadFlow?.respondentNotificationMessage,
      leadFlow?.respondentNotificationSubject,
      project?.leadNotificationEmails,
      workspace?.leadNotificationEmails,
      workspace?.leadReportRangeDays,
      workspace?.reportingTimezone
    ]
  )

  const { loading: testLoading, runAsync: runTestAsync } = useRequest(
    async (kind: 'confirmation' | 'negative_confirmation' | 'recap') => {
      const values = emailForm.getFieldsValue(true)
      const normalizedValues = normalizeProjectEmailValues(values)

      if (!helper.isValid(values.testRecipientEmail)) {
        throw new Error('Enter a test recipient email before sending a preview')
      }

      await ProjectService.testEmail(projectId, {
        emailType: kind,
        recipientEmail: values.testRecipientEmail,
        settingsOverride: normalizedValues
      })
    },
    {
      manual: true
    }
  )

  function normalizeProjectEmailValues(values: AnyMap) {
    return {
      enableRespondentNotification: Boolean(values.enableRespondentNotification),
      respondentNotificationSubject: helper.isValid(values.respondentNotificationSubject)
        ? values.respondentNotificationSubject
        : '',
      respondentNotificationMessage: helper.isValid(values.respondentNotificationMessage)
        ? values.respondentNotificationMessage
        : '',
      respondentNegativeNotificationSubject: helper.isValid(values.respondentNegativeNotificationSubject)
        ? values.respondentNegativeNotificationSubject
        : '',
      respondentNegativeNotificationMessage: helper.isValid(values.respondentNegativeNotificationMessage)
        ? values.respondentNegativeNotificationMessage
        : '',
      enableLeadReport: Boolean(values.enableLeadReport),
      leadReportEmails: parseEmailList(values.leadReportEmailsText),
      leadReportFrequency: values.leadReportFrequency || 'monthly',
      leadReportRangeDays: helper.isValid(values.leadReportRangeDays)
        ? Number(values.leadReportRangeDays)
        : null,
      reportingTimezone: helper.isValid(values.reportingTimezone) ? values.reportingTimezone : '',
      leadReportSubject: helper.isValid(values.leadReportSubject) ? values.leadReportSubject : '',
      leadReportMessage: helper.isValid(values.leadReportMessage) ? values.leadReportMessage : ''
    }
  }

  async function saveProjectEmail(values: AnyMap) {
    const normalizedValues = normalizeProjectEmailValues(values)

    await ProjectService.update(projectId, {
      ...normalizedValues,
      leadReportEmails:
        normalizedValues.leadReportEmails.length > 0 ? normalizedValues.leadReportEmails : null,
      leadReportRangeDays:
        helper.isValid(normalizedValues.leadReportRangeDays) && normalizedValues.leadReportRangeDays > 0
          ? normalizedValues.leadReportRangeDays
          : null,
      reportingTimezone: helper.isValid(normalizedValues.reportingTimezone)
        ? normalizedValues.reportingTimezone
        : '',
      respondentNotificationSubject: helper.isValid(normalizedValues.respondentNotificationSubject)
        ? normalizedValues.respondentNotificationSubject
        : null,
      respondentNotificationMessage: helper.isValid(normalizedValues.respondentNotificationMessage)
        ? normalizedValues.respondentNotificationMessage
        : null,
      respondentNegativeNotificationSubject: helper.isValid(
        normalizedValues.respondentNegativeNotificationSubject
      )
        ? normalizedValues.respondentNegativeNotificationSubject
        : null,
      respondentNegativeNotificationMessage: helper.isValid(
        normalizedValues.respondentNegativeNotificationMessage
      )
        ? normalizedValues.respondentNegativeNotificationMessage
        : null,
      leadReportSubject: helper.isValid(normalizedValues.leadReportSubject)
        ? normalizedValues.leadReportSubject
        : null,
      leadReportMessage: helper.isValid(normalizedValues.leadReportMessage)
        ? normalizedValues.leadReportMessage
        : null
    })

    updateProject(workspaceId, projectId, {
      enableRespondentNotification: normalizedValues.enableRespondentNotification,
      respondentNotificationSubject: helper.isValid(normalizedValues.respondentNotificationSubject)
        ? normalizedValues.respondentNotificationSubject
        : undefined,
      respondentNotificationMessage: helper.isValid(normalizedValues.respondentNotificationMessage)
        ? normalizedValues.respondentNotificationMessage
        : undefined,
      respondentNegativeNotificationSubject: helper.isValid(
        normalizedValues.respondentNegativeNotificationSubject
      )
        ? normalizedValues.respondentNegativeNotificationSubject
        : undefined,
      respondentNegativeNotificationMessage: helper.isValid(
        normalizedValues.respondentNegativeNotificationMessage
      )
        ? normalizedValues.respondentNegativeNotificationMessage
        : undefined,
      enableLeadReport: normalizedValues.enableLeadReport,
      leadReportEmails:
        normalizedValues.leadReportEmails.length > 0 ? normalizedValues.leadReportEmails : undefined,
      leadReportFrequency: normalizedValues.leadReportFrequency,
      leadReportRangeDays:
        helper.isValid(normalizedValues.leadReportRangeDays) && normalizedValues.leadReportRangeDays > 0
          ? normalizedValues.leadReportRangeDays
          : undefined,
      reportingTimezone: helper.isValid(normalizedValues.reportingTimezone)
        ? normalizedValues.reportingTimezone
        : undefined,
      leadReportSubject: helper.isValid(normalizedValues.leadReportSubject)
        ? normalizedValues.leadReportSubject
        : undefined,
      leadReportMessage: helper.isValid(normalizedValues.leadReportMessage)
        ? normalizedValues.leadReportMessage
        : undefined
    })

    await refreshAsync()

    toast({
      title: 'Project email settings updated',
      message: 'Confirmation defaults and campaign recap settings were saved.'
    })
  }

  async function handleTest(kind: 'confirmation' | 'negative_confirmation' | 'recap') {
    setTestKind(kind)

    try {
      await runTestAsync(kind)

      const title =
        kind === 'confirmation'
          ? 'Confirmation test sent'
          : kind === 'negative_confirmation'
            ? 'Negative confirmation test sent'
            : 'Campaign recap test sent'
      const message =
        kind === 'confirmation'
          ? 'A sample lead confirmation email was sent to the designated address.'
          : kind === 'negative_confirmation'
            ? 'A sample negative-result confirmation email was sent to the designated address.'
            : 'A campaign recap preview was sent to the designated address.'

      toast({
        title,
        message
      })
    } catch (testError: any) {
      toast({
        title: t('components.error.title'),
        message: testError.message || 'Unable to send the requested email test.',
        duration: 7000
      })
    } finally {
      setTestKind(null)
    }
  }

  if (loading) {
    return (
      <div className="mt-6">
        <section>
          <div className="max-w-3xl">
            <h2 className="hf-section-title">Project email</h2>
            <p data-slot="text" className="text-secondary mt-4 text-base/5 sm:text-sm/6">
              Loading project email settings...
            </p>
          </div>
        </section>
      </div>
    )
  }

  if (error || !leadFlow) {
    return (
      <div className="mt-6">
        <section>
          <div className="max-w-3xl">
            <h2 className="hf-section-title">Project email</h2>
            <p data-slot="text" className="text-error mt-4 text-base/5 sm:text-sm/6">
              {error?.message || 'Project email settings are unavailable right now.'}
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
          <h2 className="hf-section-title">Project email</h2>
          <p data-slot="text" className="text-secondary mt-4 text-base/5 sm:text-sm/6">
            Configure project-level confirmation defaults and campaign recap emails without overriding forms that already have their own custom notification copy.
          </p>
        </div>

        <div className="mt-6 max-w-3xl">
          <Form.Simple
            key={`${projectId}:${JSON.stringify(initialValues)}`}
            form={emailForm}
            className="space-y-6"
            initialValues={initialValues}
            fetch={saveProjectEmail}
            refreshDeps={[projectId, leadFlow?.leadReportLastSentAt]}
            submitProps={{
              label: 'Save email settings',
              className: 'w-full sm:w-auto'
            }}
            submitOnChangedOnly
          >
            <div className="space-y-6 rounded-2xl border border-accent-light p-5">
              <div>
                <h3 className="text-base font-semibold">Lead confirmation email</h3>
                <p className="text-secondary mt-1 text-sm/6">
                  These defaults apply across the project when a form does not already define its own respondent confirmation email.
                </p>
              </div>

              <Form.Item
                className="[&_[data-slot=content]]:pt-1.5"
                name="enableRespondentNotification"
                label="Project confirmation default"
                description="Send an automatic confirmation email when a submission includes a respondent email and the form has not explicitly overridden this behavior."
                isInline
              >
                <Switch />
              </Form.Item>

              <Form.Item
                name="respondentNotificationSubject"
                label="Confirmation email subject"
                footer={confirmationTemplateFooter}
              >
                <Input placeholder="We received your submission for {formName}" />
              </Form.Item>

              <Form.Item
                name="respondentNotificationMessage"
                label="Confirmation email message"
                footer={confirmationTemplateFooter}
              >
                <Input.TextArea
                  rows={6}
                  placeholder={
                    'Hi {respondentName},\n\nThanks for your submission to {formName}. We received it on {submittedAt}. A team member will review it and follow up if needed.'
                  }
                />
              </Form.Item>

              <Form.Item
                name="respondentNegativeNotificationSubject"
                label="Negative result subject"
                footer="Used when a submission includes any selected scored answer with score 0."
              >
                <Input placeholder="Your result for {formName}" />
              </Form.Item>

              <Form.Item
                name="respondentNegativeNotificationMessage"
                label="Negative result message"
                footer={confirmationTemplateFooter}
              >
                <Input.TextArea
                  rows={6}
                  placeholder={
                    'Hi {respondentName},\n\nThanks for completing {formName}. Based on your answers, this result is negative right now. We recorded your submission on {submittedAt}.'
                  }
                />
              </Form.Item>
            </div>

            <div className="space-y-6 rounded-2xl border border-accent-light p-5">
              <div>
                <h3 className="text-base font-semibold">Campaign recap email</h3>
                <p className="text-secondary mt-1 text-sm/6">
                  Send client-facing recap emails with the amount of leads received since the last recap, plus the live campaign summary and recent lead log.
                </p>
              </div>

              <Form.Item
                className="[&_[data-slot=content]]:pt-1.5"
                name="enableLeadReport"
                label="Enable campaign recap emails"
                description="Recap emails are sent on the selected cadence using the project reporting timezone."
                isInline
              >
                <Switch />
              </Form.Item>

              <Form.Item
                name="leadReportEmailsText"
                label="Campaign recap recipients"
                footer="One email address per line. These recipients are only used for recap emails and do not affect internal lead alerts."
              >
                <Input.TextArea rows={5} placeholder={'client@example.com\nmarketing@example.com'} />
              </Form.Item>

              <div className="grid gap-4 sm:grid-cols-2">
                <Form.Item name="leadReportFrequency" label="Recap cadence">
                  <Select
                    className="w-full"
                    options={REPORT_FREQUENCY_OPTIONS}
                    contentProps={{
                      position: 'popper'
                    }}
                  />
                </Form.Item>

                <Form.Item
                  name="leadReportRangeDays"
                  label="First recap lookback window (days)"
                  footer={
                    leadFlow?.leadReportLastSentAt
                      ? `Last campaign recap: ${new Date(leadFlow.leadReportLastSentAt * 1000).toLocaleString()}`
                      : 'Used only before the first recap has ever been sent. After that, the email counts leads since the last recap.'
                  }
                >
                  <Input type="number" min={1} max={365} placeholder="30" />
                </Form.Item>
              </div>

              <Form.Item
                name="reportingTimezone"
                label="Reporting timezone"
                footer="Controls the recap send window and the timestamps shown in recap emails."
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
                name="leadReportSubject"
                label="Campaign recap subject"
                footer={recapTemplateFooter}
              >
                <Input placeholder="{projectName} {frequencyLabel} lead recap - {dateRange}" />
              </Form.Item>

              <Form.Item
                name="leadReportMessage"
                label="Campaign recap intro message"
                footer={`${recapTemplateFooter} The metrics, activity log, top forms, and recent lead table are appended automatically below this intro.`}
              >
                <Input.TextArea
                  rows={6}
                  placeholder={
                    'Since the last recap, {leadCount} leads were received for {projectName}. This summary covers {startDate} to {endDate} in {reportingTimezone}.'
                  }
                />
              </Form.Item>
            </div>

            <div className="space-y-6 rounded-2xl border border-accent-light p-5">
              <div>
                <h3 className="text-base font-semibold">Send test</h3>
                <p className="text-secondary mt-1 text-sm/6">
                  Send a preview to any designated email address using the values currently shown here, even if you have not saved them yet.
                </p>
              </div>

              <Form.Item
                name="testRecipientEmail"
                label="Test recipient email"
                footer="Use one address at a time for manual previews."
              >
                <Input placeholder="preview@example.com" />
              </Form.Item>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  size="md"
                  loading={testLoading && testKind === 'confirmation'}
                  onClick={() => handleTest('confirmation')}
                >
                  Send confirmation test
                </Button>

                <Button.Ghost
                  size="md"
                  loading={testLoading && testKind === 'negative_confirmation'}
                  onClick={() => handleTest('negative_confirmation')}
                >
                  Send negative confirmation test
                </Button.Ghost>

                <Button.Ghost
                  size="md"
                  loading={testLoading && testKind === 'recap'}
                  onClick={() => handleTest('recap')}
                >
                  Send recap test
                </Button.Ghost>
              </div>
            </div>
          </Form.Simple>
        </div>
      </section>
    </div>
  )
}