import { FormStatusEnum } from '@neptunysform-inc/shared-types-enums'
import { useRequest } from 'ahooks'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FormService, ProjectService } from '@/services'
import { useParam } from '@/utils'

import { Button, EmptyState, Repeat, Skeleton } from '@/components'
import { useAppStore } from '@/store'
import { FormType, ProjectLaunchOverviewType } from '@/types'

import FormItem from './FormItem'

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

  const { projectId } = useParam()
  const { openModal } = useAppStore()
  const [forms, setForms] = useState<FormType[]>([])
  const [overview, setOverview] = useState<ProjectLaunchOverviewType>()

  const { loading, refreshAsync } = useRequest(
    async () => {
      const [nextForms, nextOverview] = await Promise.all([
        FormService.forms(projectId, FormStatusEnum.NORMAL),
        ProjectService.launchOverview(projectId)
      ])

      setForms(nextForms)
      setOverview(nextOverview)

      return true
    },
    {
      refreshDeps: [projectId]
    }
  )

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
        <div>
          <h2 className="hf-section-title">Project overview</h2>
          <p className="text-secondary mt-1 max-w-3xl text-sm/6">
            Monitor active forms, experiments, and recent lead activity. Public launch routing and
            client reporting now live in the Settings tab.
          </p>
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
              value={String(overview?.experimentCount || 0)}
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
      </section>

      <section className="hf-card p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="hf-section-title">Forms</h2>
            <p className="text-secondary mt-1 text-sm/6">
              Published forms stay available for direct links, embeds, experiments, and the
              project launch route configured in Settings.
            </p>
          </div>

          <Button
            className="self-start shrink-0 whitespace-nowrap"
            size="md"
            onClick={() => openModal('CreateFormModal')}
          >
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
