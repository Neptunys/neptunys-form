import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FormStatusEnum } from '@neptunysform-inc/shared-types-enums'
import { useRequest } from 'ahooks'

import { FormService, ProjectService } from '@/services'
import { useWorkspaceStore } from '@/store'
import { getTimeZone, normalizeCustomDomain, useParam } from '@/utils'
import { helper, slugify } from '@neptunysform-inc/utils'

import { Button, Form, Input, Select, Skeleton, Switch, useToast } from '@/components'

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

const LAUNCH_MODE_OPTIONS = [
  {
    label: 'Direct form',
    value: 'form'
  },
  {
    label: 'Experiment',
    value: 'experiment'
  }
]

function formatDateInput(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getDefaultReportStartDate() {
  const value = new Date()

  value.setDate(value.getDate() - 29)

  return formatDateInput(value)
}

function normalizeProjectLaunchPath(value?: string) {
  if (!helper.isValid(value)) {
    return undefined
  }

  const normalized = slugify(value!, {
    replacement: '-',
    lower: true,
    strict: true,
    trim: true
  })
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || undefined
}

export default function ProjectSettings() {
  const { t } = useTranslation()
  const { workspaceId, projectId } = useParam()
  const { project, workspace, updateProject } = useWorkspaceStore()
  const toast = useToast()
  const [settingsForm] = Form.useForm()
  const [draftValues, setDraftValues] = useState<AnyMap>({})
  const [reportStartDate, setReportStartDate] = useState(getDefaultReportStartDate)
  const [reportEndDate, setReportEndDate] = useState(() => formatDateInput(new Date()))
  const [reportLoading, setReportLoading] = useState(false)

  const { data, loading: routeOptionsLoading, refreshAsync: refreshRouteOptions } = useRequest(
    async () => {
      const [forms, experiments] = await Promise.all([
        FormService.forms(projectId, FormStatusEnum.NORMAL),
        ProjectService.experiments(projectId)
      ])

      return {
        forms,
        experiments
      }
    },
    {
      refreshDeps: [projectId]
    }
  )

  const forms = useMemo(() => data?.forms ?? [], [data?.forms])
  const experiments = useMemo(() => data?.experiments ?? [], [data?.experiments])
  const formOptions = useMemo(
    () =>
      forms.map(form => ({
        label: form.name || 'Untitled form',
        value: form.id
      })),
    [forms]
  )
  const experimentOptions = useMemo(
    () =>
      experiments.map(experiment => ({
        label: experiment.name || 'Untitled experiment',
        value: experiment.id
      })),
    [experiments]
  )
  const formNameMap = useMemo(
    () => new Map(forms.map(form => [form.id, form.name || 'Untitled form'])),
    [forms]
  )
  const experimentNameMap = useMemo(
    () => new Map(experiments.map(experiment => [experiment.id, experiment.name || 'Untitled experiment'])),
    [experiments]
  )
  const normalizedDomain = normalizeCustomDomain(workspace?.customDomain)
  const projectLeadNotificationEmailsText = (project?.leadNotificationEmails || []).join('\n')

  const initialValues = useMemo(
    () => ({
      leadNotificationEmailsText: projectLeadNotificationEmailsText,
      launchPath: project?.launchPath ?? '',
      launchMode: project?.launchMode ?? (experiments.length > 0 ? 'experiment' : 'form'),
      launchFormId: project?.launchFormId ?? forms[0]?.id,
      launchExperimentId: project?.launchExperimentId ?? experiments[0]?.id
    }),
    [
      experiments,
      forms,
      projectLeadNotificationEmailsText,
      project?.launchPath,
      project?.launchMode,
      project?.launchFormId,
      project?.launchExperimentId
    ]
  )
  const initialValuesKey = useMemo(() => JSON.stringify(initialValues), [initialValues])

  const selectedLaunchMode = draftValues.launchMode || initialValues.launchMode || 'form'
  const selectedLaunchFormId = draftValues.launchFormId || initialValues.launchFormId
  const selectedLaunchExperimentId =
    draftValues.launchExperimentId || initialValues.launchExperimentId
  const normalizedLaunchPath = normalizeProjectLaunchPath(
    draftValues.launchPath ?? initialValues.launchPath
  )
  const launchPreviewUrl =
    normalizedDomain && helper.isValid(normalizedLaunchPath)
      ? `https://${normalizedDomain}/${normalizedLaunchPath}`
      : undefined
  const selectedLaunchTargetLabel =
    selectedLaunchMode === 'experiment'
      ? experimentNameMap.get(selectedLaunchExperimentId) || 'No experiment selected'
      : formNameMap.get(selectedLaunchFormId) || 'No form selected'

  useEffect(() => {
    setDraftValues(initialValues)
  }, [initialValuesKey])

  async function saveProjectSettings(values: AnyMap) {
    const notificationEmails = parseEmailList(values.leadNotificationEmailsText)
    const launchMode = values.launchMode || 'form'
    const launchFormId = launchMode === 'form' ? values.launchFormId : ''
    const launchExperimentId = launchMode === 'experiment' ? values.launchExperimentId : ''
    const nextLaunchPath = normalizeProjectLaunchPath(values.launchPath)

    if (launchMode === 'form' && !helper.isValid(launchFormId)) {
      throw new Error('Select a form to use as the launch destination.')
    }

    if (launchMode === 'experiment' && !helper.isValid(launchExperimentId)) {
      throw new Error('Select an experiment to use as the launch destination.')
    }

    await ProjectService.update(projectId, {
      leadNotificationEmails: notificationEmails.length > 0 ? notificationEmails : null,
      launchPath: helper.isValid(values.launchPath) ? values.launchPath : '',
      launchMode,
      launchFormId,
      launchExperimentId
    })

    updateProject(workspaceId, projectId, {
      leadNotificationEmails: notificationEmails.length > 0 ? notificationEmails : undefined,
      launchPath: nextLaunchPath,
      launchMode,
      launchFormId: helper.isValid(launchFormId) ? launchFormId : undefined,
      launchExperimentId: helper.isValid(launchExperimentId) ? launchExperimentId : undefined
    })

    setDraftValues({
      ...values,
      launchPath: nextLaunchPath || '',
      launchMode,
      launchFormId,
      launchExperimentId
    })
    await refreshRouteOptions()

    toast({
      title: 'Project settings updated',
      message: 'Project routing and internal lead routing were saved.'
    })
  }

  async function handleDownloadReport() {
    if (!helper.isValid(reportStartDate) || !helper.isValid(reportEndDate)) {
      toast({
        title: t('components.error.title'),
        message: 'Choose a valid start and end date for the report.'
      })
      return
    }

    if (reportStartDate > reportEndDate) {
      toast({
        title: t('components.error.title'),
        message: 'The start date must be on or before the end date.'
      })
      return
    }

    setReportLoading(true)

    try {
      await ProjectService.downloadReport(projectId, {
        startDate: reportStartDate,
        endDate: reportEndDate
      })
    } catch (err: any) {
      toast({
        title: t('components.error.title'),
        message: err.message || 'Unable to download the project report.'
      })
    } finally {
      setReportLoading(false)
    }
  }

  return (
    <div className="mt-6">
      <section>
        <div className="max-w-3xl">
          <h2 className="hf-section-title">Project settings</h2>
          <p data-slot="text" className="text-secondary mt-4 text-base/5 sm:text-sm/6">
            Configure internal lead routing, launch behavior, and report exports for this project.
            Project confirmation emails and campaign recaps now live in the Email tab.
          </p>
        </div>

        <div className="mt-6 max-w-3xl">
          <Form.Simple
            key={`${projectId}:${initialValuesKey}`}
            form={settingsForm}
            className="space-y-6"
            initialValues={initialValues}
            fetch={saveProjectSettings}
            refreshDeps={[projectId, project?.leadReportLastSentAt]}
            submitProps={{
              label: 'Save project settings',
              className: 'w-full sm:w-auto'
            }}
            submitOnChangedOnly
            onValuesChange={(changedValues, values) => {
              if (changedValues.launchMode === 'form' && !values.launchFormId && forms[0]?.id) {
                settingsForm.setFieldsValue({
                  launchFormId: forms[0].id
                })
              }

              if (
                changedValues.launchMode === 'experiment' &&
                !values.launchExperimentId &&
                experiments[0]?.id
              ) {
                settingsForm.setFieldsValue({
                  launchExperimentId: experiments[0].id
                })
              }

              setDraftValues(values)
            }}
          >
            <div className="space-y-6 rounded-2xl border border-accent-light p-5">
              <div>
                <h3 className="text-base font-semibold">Internal lead routing</h3>
                <p className="text-secondary mt-1 text-sm/6">
                  Route project leads to specific internal recipients. Client-facing confirmation and recap emails are configured in the Email tab.
                </p>
              </div>

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

            <div className="space-y-6 rounded-2xl border border-accent-light p-5">
              <div>
                <h3 className="text-base font-semibold">Project launch</h3>
                <p className="text-secondary mt-1 text-sm/6">
                  Set the public campaign path on your custom domain and choose whether it should
                  open a direct form or an experiment.
                </p>
              </div>

              <div className="rounded-2xl border border-accent-light bg-transparent px-4 py-4">
                <div className="text-secondary text-xs font-medium uppercase tracking-wide">
                  Launch URL
                </div>
                <div className="text-primary mt-2 break-all text-base font-semibold">
                  {launchPreviewUrl || 'Connect a custom domain and set a launch path to activate a campaign URL.'}
                </div>
                <div className="text-secondary mt-2 text-sm/6">
                  Current destination: {selectedLaunchTargetLabel}
                </div>
                {!normalizedDomain && (
                  <div className="text-secondary border-accent-light mt-3 rounded-xl border border-dashed px-3 py-2 text-sm/6">
                    Project launch paths resolve on the workspace custom domain. Without one,
                    share links still use the direct form or experiment URLs.
                  </div>
                )}
              </div>

              {routeOptionsLoading ? (
                <Skeleton className="h-24 rounded-2xl" loading />
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Form.Item
                      name="launchPath"
                      label="Launch path"
                      footer="Example: spring-campaign. Leave blank to disable the project alias."
                    >
                      <Input placeholder="spring-campaign" />
                    </Form.Item>

                    <Form.Item name="launchMode" label="Launch destination" initialValue="form">
                      <Select
                        options={LAUNCH_MODE_OPTIONS.map(option => ({
                          ...option,
                          disabled:
                            (option.value === 'form' && formOptions.length < 1) ||
                            (option.value === 'experiment' && experimentOptions.length < 1)
                        }))}
                      />
                    </Form.Item>
                  </div>

                  {selectedLaunchMode === 'experiment' ? (
                    <Form.Item
                      name="launchExperimentId"
                      label="Experiment"
                      footer="Only published experiment routes should be used as campaign entry points."
                    >
                      <Select
                        options={experimentOptions}
                        placeholder={
                          experimentOptions.length > 0
                            ? 'Select an experiment'
                            : 'Create an experiment first'
                        }
                        disabled={experimentOptions.length < 1}
                      />
                    </Form.Item>
                  ) : (
                    <Form.Item
                      name="launchFormId"
                      label="Form"
                      footer="Choose the direct form that should load when someone visits this project URL."
                    >
                      <Select
                        options={formOptions}
                        placeholder={formOptions.length > 0 ? 'Select a form' : 'Create a form first'}
                        disabled={formOptions.length < 1}
                      />
                    </Form.Item>
                  )}
                </>
              )}
            </div>

            <div className="space-y-6 rounded-2xl border border-accent-light p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold">Client report</h3>
                  <p className="text-secondary mt-1 text-sm/6">
                    Download the client-facing workbook for a specific window. Scheduled recap emails are configured in the Email tab and sent separately.
                  </p>
                </div>

                <Button size="md" loading={reportLoading} onClick={handleDownloadReport}>
                  Download XLSX report
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,13rem)_minmax(0,13rem)_1fr]">
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="text-secondary text-xs font-medium uppercase tracking-wide">From</span>
                  <Input type="date" value={reportStartDate} disabled={reportLoading} onChange={setReportStartDate} />
                </label>

                <label className="flex min-w-0 flex-col gap-1">
                  <span className="text-secondary text-xs font-medium uppercase tracking-wide">To</span>
                  <Input type="date" value={reportEndDate} disabled={reportLoading} onChange={setReportEndDate} />
                </label>

                <div className="text-secondary border-accent-light rounded-2xl border px-4 py-4 text-sm/6">
                  The downloadable report includes a cleaner summary, form performance view, and a
                  lead log for the selected date range.
                </div>
              </div>
            </div>
          </Form.Simple>
        </div>
      </section>
    </div>
  )
}