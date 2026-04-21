import { FormStatusEnum } from '@neptunysform-inc/shared-types-enums'
import { IconCopy, IconTrash } from '@tabler/icons-react'
import { useRequest } from 'ahooks'
import { useEffect, useMemo, useState } from 'react'

import { FormService, ProjectService } from '@/services'
import { normalizeCustomDomain, useParam } from '@/utils'
import { helper, toDuration, toFixed } from '@neptunysform-inc/utils'

import { Badge, Button, Form, Input, Select, Skeleton, Switch, useToast } from '@/components'
import { useWorkspaceStore } from '@/store'
import { ExperimentType } from '@/types'

const DURATION_OPTIONS = [
  { label: '24 hours', value: 24 },
  { label: '48 hours', value: 48 },
  { label: '72 hours', value: 72 },
  { label: '7 days', value: 24 * 7 }
]

function getVariantWeightDrafts(experiment: ExperimentType) {
  return (experiment.variants || []).reduce(
    (result, variant) => ({
      ...result,
      [variant.formId]: String(variant.weight ?? '')
    }),
    {} as Record<string, string>
  )
}

function parseVariantWeight(value: unknown) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return 0
  }

  return Math.max(0, Math.round(numericValue))
}

function formatExperimentDate(timestampValue?: number) {
  if (!timestampValue) {
    return 'No end date'
  }

  const normalizedTimestamp = timestampValue < 1_000_000_000_000 ? timestampValue * 1000 : timestampValue
  return new Date(normalizedTimestamp).toLocaleString()
}

function ExperimentCard({
  experiment,
  formNameMap,
  sharingURLPrefix,
  isLaunchTarget,
  launchAliasUrl,
  onDelete,
  onUpdateSplit
}: {
  experiment: ExperimentType
  formNameMap: Map<string, string>
  sharingURLPrefix: string
  isLaunchTarget?: boolean
  launchAliasUrl?: string
  onDelete: (experimentId: string) => Promise<void>
  onUpdateSplit: (
    experimentId: string,
    variants: Array<{ formId: string; weight: number }>
  ) => Promise<void>
}) {
  const toast = useToast()
  const [draftWeights, setDraftWeights] = useState<Record<string, string>>(() =>
    getVariantWeightDrafts(experiment)
  )
  const [isSavingSplit, setIsSavingSplit] = useState(false)

  useEffect(() => {
    setDraftWeights(getVariantWeightDrafts(experiment))
  }, [experiment])

  const requestedWeightTotal = useMemo(
    () =>
      experiment.variants.reduce(
        (total, variant) => total + parseVariantWeight(draftWeights[variant.formId]),
        0
      ),
    [draftWeights, experiment.variants]
  )
  const isSplitDirty = useMemo(
    () =>
      experiment.variants.some(
        variant => String(parseVariantWeight(draftWeights[variant.formId])) !== String(variant.weight)
      ),
    [draftWeights, experiment.variants]
  )

  async function handleCopy(url: string, label: string) {
    await navigator.clipboard.writeText(url)
    toast({
      title: `${label} copied`,
      message: url
    })
  }

  function handleWeightChange(formId: string, value: any) {
    setDraftWeights(current => ({
      ...current,
      [formId]: String(value ?? '')
    }))
  }

  function getVariantPreviewUrl(formId: string) {
    const baseUrl =
      isLaunchTarget && launchAliasUrl
        ? launchAliasUrl
        : `${sharingURLPrefix}/x/${experiment.id}`

    const separator = baseUrl.includes('?') ? '&' : '?'
    return `${baseUrl}${separator}variant=${encodeURIComponent(formId)}`
  }

  async function handleSaveSplit() {
    const variants = experiment.variants.map(variant => ({
      formId: variant.formId,
      weight: parseVariantWeight(draftWeights[variant.formId])
    }))

    if (variants.some(variant => variant.weight < 1)) {
      toast({
        title: 'Invalid traffic split',
        message: 'Each variant needs at least 1% requested traffic before you can save.',
        duration: 7000
      })
      return
    }

    setIsSavingSplit(true)

    try {
      await onUpdateSplit(experiment.id, variants)
      toast({
        title: 'Traffic split updated',
        message:
          requestedWeightTotal === 100
            ? 'The experiment traffic split was updated.'
            : `Requested weights totaled ${requestedWeightTotal}%. Neptunysform normalized them to 100% on save.`
      })
    } finally {
      setIsSavingSplit(false)
    }
  }

  return (
    <div className="hf-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-lg font-semibold">{experiment.name}</div>
            {isLaunchTarget && <Badge color="sky">Project launch target</Badge>}
          </div>
          <div className="text-secondary mt-1 text-sm/6">
            {experiment.status} · ends {formatExperimentDate(experiment.endAt)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {launchAliasUrl && (
            <Button.Link size="sm" onClick={() => handleCopy(launchAliasUrl, 'Launch URL')}>
              <IconCopy className="h-4 w-4" />
              <span>Copy launch URL</span>
            </Button.Link>
          )}
          <Button.Link
            size="sm"
            onClick={() => handleCopy(`${sharingURLPrefix}/x/${experiment.id}`, 'Experiment link')}
          >
            <IconCopy className="h-4 w-4" />
            <span>Copy link</span>
          </Button.Link>
          <Button.Link size="sm" className="text-error" onClick={() => onDelete(experiment.id)}>
            <IconTrash className="h-4 w-4" />
            <span>Delete</span>
          </Button.Link>
        </div>
      </div>

      {helper.isValid(experiment.promotionBlockedReason) && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm/6 text-amber-900">
          {experiment.promotionBlockedReason}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="hf-card-muted px-4 py-3">
          <div className="text-secondary text-xs font-medium uppercase tracking-wide">Primary metric</div>
          <div className="mt-1 font-semibold">Conversion rate</div>
        </div>
        <div className="hf-card-muted px-4 py-3">
          <div className="text-secondary text-xs font-medium uppercase tracking-wide">Auto-promote</div>
          <div className="mt-1 font-semibold">{experiment.autoPromote ? 'Enabled' : 'Manual review'}</div>
        </div>
        <div className="hf-card-muted px-4 py-3">
          <div className="text-secondary text-xs font-medium uppercase tracking-wide">Minimum sample</div>
          <div className="mt-1 font-semibold">{experiment.minimumSampleSize || 0} visits</div>
          <div className="text-secondary mt-1 text-sm/6">
            {experiment.minimumSampleReached
              ? 'Every variant passed the promotion threshold.'
              : 'Winner promotion stays blocked until every variant reaches the threshold.'}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-accent-light p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Traffic split</div>
            <p className="text-secondary mt-1 text-sm/6">
              Visitors stay on the same variant once assigned. Use the preview links below to QA each version, or open a private window for a fresh allocation.
            </p>
          </div>

          <Button.Ghost size="sm" loading={isSavingSplit} disabled={!isSplitDirty} onClick={handleSaveSplit}>
            Save traffic split
          </Button.Ghost>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {experiment.variants.map(variant => {
            const formName = formNameMap.get(variant.formId) || variant.formId
            const requestedWeight = parseVariantWeight(draftWeights[variant.formId])

            return (
              <div key={variant.formId} className="hf-card-muted px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{formName}</div>
                    <div className="text-secondary mt-1 text-xs/5">Requested traffic share</div>
                  </div>

                  <div className="w-24 shrink-0">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={draftWeights[variant.formId] ?? ''}
                      onChange={value => handleWeightChange(variant.formId, value)}
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-secondary text-xs/5">{requestedWeight}% requested</div>

                  <Button.Link
                    size="sm"
                    onClick={() => handleCopy(getVariantPreviewUrl(variant.formId), 'Variant preview URL')}
                  >
                    <IconCopy className="h-4 w-4" />
                    <span>Copy preview</span>
                  </Button.Link>
                </div>
              </div>
            )
          })}
        </div>

        {requestedWeightTotal !== 100 && (
          <p className="text-secondary mt-3 text-xs/5">
            Requested traffic totals {requestedWeightTotal}%. Neptunysform normalizes the saved split to 100% automatically.
          </p>
        )}
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-secondary">
            <tr>
              <th className="py-2 pr-4 font-medium">Variant</th>
              <th className="py-2 pr-4 font-medium">Weight</th>
              <th className="py-2 pr-4 font-medium">Visits</th>
              <th className="py-2 pr-4 font-medium">Submissions</th>
              <th className="py-2 pr-4 font-medium">Conversion</th>
              <th className="py-2 font-medium">Avg completion time</th>
            </tr>
          </thead>
          <tbody>
            {(experiment.metrics || []).map(metric => (
              <tr key={metric.formId} className="border-accent-light border-t">
                <td className="py-3 pr-4">
                  <div className="font-medium">{formNameMap.get(metric.formId) || metric.formId}</div>
                  {metric.isWinner && (
                    <div className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      Best performer
                    </div>
                  )}
                  {!metric.meetsMinimumSample && helper.isValid(metric.minimumSampleGap) && metric.minimumSampleGap! > 0 && (
                    <div className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      Needs {metric.minimumSampleGap} more visits
                    </div>
                  )}
                </td>
                <td className="py-3 pr-4">{metric.weight}%</td>
                <td className="py-3 pr-4">{metric.visits}</td>
                <td className="py-3 pr-4">{metric.submissions}</td>
                <td className="py-3 pr-4">{toFixed(metric.conversionRate)}%</td>
                <td className="py-3">{toDuration(Math.round(metric.averageTime || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ProjectExperiments() {
  const { projectId } = useParam()
  const { project, sharingURLPrefix, workspace } = useWorkspaceStore()
  const [rcForm] = Form.useForm()
  const toast = useToast()
  const normalizedDomain = normalizeCustomDomain(workspace?.customDomain)

  const { data, loading, refreshAsync } = useRequest(
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

  const formOptions = useMemo(
    () =>
      (data?.forms || []).map(form => ({
        label: form.name || 'Untitled',
        value: form.id
      })),
    [data?.forms]
  )

  const formNameMap = useMemo(
    () => new Map((data?.forms || []).map(form => [form.id, form.name || 'Untitled'])),
    [data?.forms]
  )

  async function handleCreate(values: {
    name: string
    variants: string[]
    durationHours: number
    minimumSampleSize?: number
    autoPromote?: boolean
  }) {
    if (!helper.isValidArray(values.variants) || values.variants.length < 2) {
      throw new Error('Select at least two forms to start an experiment.')
    }

    await ProjectService.createExperiment({
      projectId,
      name: values.name,
      variants: values.variants.map(formId => ({ formId })),
      durationHours: Number(values.durationHours) || 48,
      minimumSampleSize: Number(values.minimumSampleSize) || 0,
      autoPromote: helper.isNil(values.autoPromote) ? true : values.autoPromote
    })

    rcForm.resetFields()
    await refreshAsync()
    toast({
      title: 'Experiment created',
      message: 'Traffic is now being split across the selected form variants.'
    })
  }

  async function handleDelete(experimentId: string) {
    if (!window.confirm('Delete this experiment?')) {
      return
    }

    await ProjectService.deleteExperiment(projectId, experimentId)
    await refreshAsync()
    toast({
      title: 'Experiment deleted',
      message: 'The experiment has been removed.'
    })
  }

  async function handleUpdateSplit(
    experimentId: string,
    variants: Array<{ formId: string; weight: number }>
  ) {
    await ProjectService.updateExperiment({
      projectId,
      experimentId,
      variants
    })

    await refreshAsync()
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="hf-card p-6">
        <h2 className="text-xl font-semibold">Launch experiment</h2>
        <p className="text-secondary mt-1 text-sm/6">
          Split traffic between multiple forms in this project and automatically promote the best
          converter when the test window ends. Minimum sample thresholds now block promotion until
          every variant has enough traffic.
        </p>

        <div className="mt-5">
          <Form.Simple
            className="space-y-4"
            form={rcForm}
            fetch={handleCreate}
            refreshDeps={[projectId]}
            submitProps={{
              size: 'md',
              label: 'Create experiment'
            }}
          >
            <Form.Item
              name="name"
              label="Experiment name"
              rules={[{ required: true, message: 'Enter an experiment name.' }]}
            >
              <Input placeholder="Homepage lead capture test" />
            </Form.Item>

            <Form.Item
              name="variants"
              label="Variants"
              rules={[{ required: true, message: 'Select at least two forms.' }]}
            >
              <Select.Multi
                options={formOptions}
                loading={loading}
                placeholder="Select two or more forms"
              />
            </Form.Item>

            <div className="grid gap-4 sm:grid-cols-2">
              <Form.Item name="durationHours" label="Test window" initialValue={48}>
                <Select options={DURATION_OPTIONS} />
              </Form.Item>

              <Form.Item name="minimumSampleSize" label="Minimum sample size" initialValue={0}>
                <Input type="number" min={0} placeholder="0" />
              </Form.Item>
            </div>

            <Form.Item
              className="[&_[data-slot=content]]:pt-1.5"
              name="autoPromote"
              label="Automatically promote the winner"
              description="When enabled, the best-performing variant becomes the winner after the test window ends."
              initialValue
              isInline
            >
              <Switch />
            </Form.Item>
          </Form.Simple>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-2xl" loading />
          <Skeleton className="h-48 rounded-2xl" loading />
        </div>
      ) : (
        (data?.experiments || []).map(experiment => (
          <ExperimentCard
            key={experiment.id}
            experiment={experiment}
            formNameMap={formNameMap}
            sharingURLPrefix={sharingURLPrefix}
            isLaunchTarget={
              project?.launchMode === 'experiment' && project?.launchExperimentId === experiment.id
            }
            launchAliasUrl={
              normalizedDomain &&
              project?.launchMode === 'experiment' &&
              project?.launchExperimentId === experiment.id &&
              helper.isValid(project?.launchPath)
                ? `https://${normalizedDomain}/${project!.launchPath}`
                : undefined
            }
            onDelete={handleDelete}
            onUpdateSplit={handleUpdateSplit}
          />
        ))
      )}

      {!loading && !(data?.experiments || []).length && (
        <div className="hf-card p-6 text-sm/6 text-slate-600">
          No experiments yet. Create one above to start splitting traffic across forms.
        </div>
      )}
    </div>
  )
}