import { FormStatusEnum } from '@heyform-inc/shared-types-enums'
import { useRequest } from 'ahooks'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FormService, ProjectService } from '@/services'
import { normalizeCustomDomain, useParam } from '@/utils'
import { helper, slugify } from '@heyform-inc/utils'

import { Button, EmptyState, Form, Input, Repeat, Select, Skeleton, useToast } from '@/components'
import { useAppStore, useWorkspaceStore } from '@/store'
import { ExperimentType, FormType, ProjectLaunchOverviewType } from '@/types'

import FormItem from './FormItem'

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

function formatTimestamp(value?: number) {
  if (!value) {
    return 'No recent activity yet.'
  }

  return new Date(value * 1000).toLocaleString()
}

function OverviewMetric({
  label,
  value,
  caption
}: {
  label: string
  value: string
  caption: string
}) {
  return (
    <div className="rounded-2xl border border-accent-light bg-transparent px-4 py-3">
      <div className="text-secondary text-xs font-medium uppercase tracking-wide">{label}</div>
      <div className="text-primary mt-1 text-2xl font-semibold">{value}</div>
      <div className="text-secondary mt-1 text-sm/6">{caption}</div>
    </div>
  )
}

export default function ProjectForms() {
  const { t } = useTranslation()

  const { workspaceId, projectId } = useParam()
  const { openModal } = useAppStore()
  const { project, workspace, updateProject } = useWorkspaceStore()
  const [rcForm] = Form.useForm()
  const toast = useToast()
  const [forms, setForms] = useState<FormType[]>([])
  const [experiments, setExperiments] = useState<ExperimentType[]>([])
  const [overview, setOverview] = useState<ProjectLaunchOverviewType>()
  const [draftValues, setDraftValues] = useState<AnyMap>({})

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

  const initialValues = useMemo(
    () => ({
      launchPath: project?.launchPath ?? '',
      launchMode: project?.launchMode ?? (experiments.length > 0 ? 'experiment' : 'form'),
      launchFormId: project?.launchFormId ?? forms[0]?.id,
      launchExperimentId: project?.launchExperimentId ?? experiments[0]?.id
    }),
    [experiments, forms, project]
  )

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

  const { loading, refreshAsync } = useRequest(
    async () => {
      const [nextForms, nextExperiments, nextOverview] = await Promise.all([
        FormService.forms(projectId, FormStatusEnum.NORMAL),
        ProjectService.experiments(projectId),
        ProjectService.launchOverview(projectId)
      ])

      setForms(nextForms)
      setExperiments(nextExperiments)
      setOverview(nextOverview)

      return true
    },
    {
      refreshDeps: [projectId]
    }
  )

  useEffect(() => {
    setDraftValues(initialValues)
  }, [initialValues])

  async function saveLaunchSettings(values: AnyMap) {
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
      launchPath: helper.isValid(values.launchPath) ? values.launchPath : '',
      launchMode,
      launchFormId,
      launchExperimentId
    })

    updateProject(workspaceId, projectId, {
      launchPath: nextLaunchPath,
      launchMode,
      launchFormId: helper.isValid(launchFormId) ? launchFormId : undefined,
      launchExperimentId: helper.isValid(launchExperimentId) ? launchExperimentId : undefined
    })

    setDraftValues({
      ...values,
      launchPath: nextLaunchPath || ''
    })
    await refreshAsync()
    toast({
      title: 'Project launch updated',
      message: nextLaunchPath
        ? 'The public launch route is now live.'
        : 'The launch destination was saved.'
    })
  }

  function handleChange(type: string, form: FormType) {
    switch (type) {
      case 'rename':
        setForms(f => f.map(row => (row.id === form.id ? form : row)))
        break

      case 'trash':
        setForms(f => f.filter(row => row.id !== form.id))
        break
    }
  }

  const formsSection = forms.length ? (
    <div className="mt-4">
      {forms.map(f => (
        <FormItem key={f.id} form={f} onChange={handleChange} />
      ))}
    </div>
  ) : (
    <div className="mt-4">
      <EmptyState
        headline={t('project.forms.headline')}
        subHeadline={t('dashboard.pickTemplate')}
        buttonTitle={t('form.creation.title')}
        onClick={() => openModal('CreateFormModal')}
      />
    </div>
  )

  return (
    <div className="mt-6 space-y-6">
      <section className="hf-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="hf-section-title">Project launch</h2>
            <p className="text-secondary mt-1 max-w-3xl text-sm/6">
              Choose which form or experiment should answer this project&apos;s public launch URL.
              Lead routing and reporting now live in the Settings tab.
            </p>
          </div>

          {launchPreviewUrl && (
            <Button.Copy2 text={launchPreviewUrl} label="Copy launch URL" className="shrink-0" />
          )}
        </div>

        {loading && !overview ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Repeat count={4}>
              <Skeleton className="h-28 rounded-2xl" loading />
            </Repeat>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <OverviewMetric
              label="Forms"
              value={String(overview?.formCount || forms.length || 0)}
              caption={`${overview?.publishedFormCount || 0} published and ready to launch`}
            />
            <OverviewMetric
              label="Experiments"
              value={String(overview?.experimentCount || experiments.length || 0)}
              caption={`${overview?.runningExperimentCount || 0} currently splitting traffic`}
            />
            <OverviewMetric
              label="Leads (30 days)"
              value={String(overview?.leadCount30d || 0)}
              caption={`${overview?.highPriorityLeadCount30d || 0} marked high priority`}
            />
            <OverviewMetric
              label="Last lead"
              value={overview?.lastLeadAt ? new Date(overview.lastLeadAt * 1000).toLocaleDateString() : 'None'}
              caption={formatTimestamp(overview?.lastLeadAt)}
            />
          </div>
        )}

        <div className="border-accent-light mt-6 border-t pt-6">
          <Form.Simple
            key={`${projectId}:${JSON.stringify(initialValues)}`}
            form={rcForm}
            className="space-y-6"
            initialValues={initialValues}
            fetch={saveLaunchSettings}
            refreshDeps={[projectId, overview?.lastLeadAt]}
            submitProps={{
              label: 'Save launch settings',
              className: 'w-full sm:w-auto'
            }}
            submitOnChangedOnly
            onValuesChange={(changedValues, values) => {
              if (changedValues.launchMode === 'form' && !values.launchFormId && forms[0]?.id) {
                rcForm.setFieldsValue({
                  launchFormId: forms[0].id
                })
              }

              if (
                changedValues.launchMode === 'experiment' &&
                !values.launchExperimentId &&
                experiments[0]?.id
              ) {
                rcForm.setFieldsValue({
                  launchExperimentId: experiments[0].id
                })
              }

              setDraftValues(values)
            }}
          >
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold">Public launch route</h3>
                <p className="text-secondary mt-1 text-sm/6">
                  Set the campaign path on your custom domain and choose the destination that
                  should open when someone visits it.
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
            </div>

          </Form.Simple>
        </div>
      </section>

      <section className="hf-card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="hf-section-title">Forms</h2>
            <p className="text-secondary mt-1 text-sm/6">
              Published forms stay available for direct links, embeds, experiments, and the project
              launch route configured above.
            </p>
          </div>

          <Button size="md" onClick={() => openModal('CreateFormModal')}>
            {t('form.creation.title')}
          </Button>
        </div>

        {loading && forms.length < 1 ? (
          <div className="mt-4 hf-card divide-y divide-[#e5e7eb]">
            <Repeat count={3}>
              <FormItem.Skeleton />
            </Repeat>
          </div>
        ) : (
          formsSection
        )}
      </section>
    </div>
  )
}
