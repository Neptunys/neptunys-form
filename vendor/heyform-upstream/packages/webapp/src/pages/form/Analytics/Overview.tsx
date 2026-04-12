import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-react'
import { useRequest } from 'ahooks'
import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FormService } from '@/services'
import { useParam } from '@/utils'
import { helper, toDuration, toFixed } from '@heyform-inc/utils'

import { Select, Skeleton } from '@/components'

interface TrendIndicatorProps {
  change: number | null
  label: string
}

const ANALYTIC_RANGES = [
  {
    label: 'form.analytics.7d',
    value: '7d'
  },
  {
    label: 'form.analytics.1m',
    value: '1m'
  },
  {
    label: 'form.analytics.3m',
    value: '3m'
  },
  {
    label: 'form.analytics.6m',
    value: '6m'
  },
  {
    label: 'form.analytics.1y',
    value: '1y'
  }
]

const TrendIndicator: FC<TrendIndicatorProps> = ({ change, label }) => {
  const { t } = useTranslation()

  if (helper.isNull(change)) {
    return null
  }

  return (
    <div className="mt-1 flex items-center gap-1.5 text-sm/6 sm:text-xs/6">
      {change! > 0 ? (
        <IconTrendingUp className="h-4 w-4 text-green-600" />
      ) : (
        <IconTrendingDown className="h-4 w-4 text-red-600" />
      )}
      <span className="text-secondary">
        {t(label, {
          change: (change! > 0 ? '+' : '') + toFixed(change!)
        })}
      </span>
    </div>
  )
}

export default function FormAnalyticsOverview() {
  const { t } = useTranslation()

  const { formId } = useParam()
  const [range, setRange] = useState('7d')

  const { loading, data } = useRequest(
    async () => {
      const [analytic, questions] = await Promise.all([
        FormService.analytic(formId, range),
        FormService.questionAnalytics(formId, range)
      ])

      return {
        analytic,
        questions
      }
    },
    {
      refreshDeps: [formId, range],
      pollingInterval: 10_000,
      pollingWhenHidden: false,
      refreshOnWindowFocus: true
    }
  )
  const isInitialLoading = loading && !data
  const isRefreshing = loading && !!data

  return (
    <>
      <div className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <h2 className="hf-section-title ml-6">{t('dashboard.overview')}</h2>
        <div className="mr-6 flex w-full flex-col gap-2 sm:w-auto sm:items-end">
          <div className="text-secondary flex items-center gap-2 text-sm/6">
            <span
              className={`h-2 w-2 rounded-full ${isRefreshing ? 'bg-amber-500' : 'bg-emerald-500'}`}
            />
            <span>{isRefreshing ? 'Refreshing live analytics...' : 'Live updates every 10s'}</span>
          </div>
          <Select
            className="w-full sm:w-40"
            value={range}
            options={ANALYTIC_RANGES}
            placeholder={t('form.analytics.7d')}
            disabled={isInitialLoading}
            multiLanguage
            onChange={setRange}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-6 px-6 sm:grid-cols-2 xl:grid-cols-4">
        <div className="hf-card p-5">
          <div className="hf-label-muted">{t('form.analytics.views')}</div>
          <Skeleton
            className="mt-3 h-8 [&_[data-slot=skeleton]]:h-[1.875rem] [&_[data-slot=skeleton]]:w-16 [&_[data-slot=skeleton]]:sm:h-6"
            loading={isInitialLoading}
          >
            <div className="mt-3 text-3xl/8 font-semibold sm:text-2xl/8">
              {data?.analytic?.totalVisits.value}
            </div>
          </Skeleton>

          <Skeleton
            className="mt-1 h-6 [&_[data-slot=skeleton]]:h-[0.875rem] [&_[data-slot=skeleton]]:w-40 [&_[data-slot=skeleton]]:sm:h-3"
            loading={isInitialLoading}
          >
            <TrendIndicator
              change={data?.analytic?.totalVisits.change}
              label={`form.analytics.${range}Trend`}
            />
          </Skeleton>
        </div>

        <div className="hf-card p-5">
          <div className="hf-label-muted">{t('form.submissions.title')}</div>
          <Skeleton
            className="mt-3 h-8 [&_[data-slot=skeleton]]:h-[1.875rem] [&_[data-slot=skeleton]]:w-16 [&_[data-slot=skeleton]]:sm:h-6"
            loading={isInitialLoading}
          >
            <div className="mt-3 text-3xl/8 font-semibold sm:text-2xl/8">
              {data?.analytic?.submissionCount.value}
            </div>
          </Skeleton>

          <Skeleton
            className="mt-1 h-6 [&_[data-slot=skeleton]]:h-[0.875rem] [&_[data-slot=skeleton]]:w-40 [&_[data-slot=skeleton]]:sm:h-3"
            loading={isInitialLoading}
          >
            <TrendIndicator
              change={data?.analytic?.submissionCount.change}
              label={`form.analytics.${range}Trend`}
            />
          </Skeleton>
        </div>

        <div className="hf-card p-5">
          <div className="hf-label-muted">{t('form.analytics.completeRate')}</div>
          <Skeleton
            className="mt-3 h-8 [&_[data-slot=skeleton]]:h-[1.875rem] [&_[data-slot=skeleton]]:w-16 [&_[data-slot=skeleton]]:sm:h-6"
            loading={isInitialLoading}
          >
            <div className="mt-3 text-3xl/8 font-semibold sm:text-2xl/8">
              {`${toFixed(data?.analytic?.completeRate.value || 0)}%`}
            </div>
          </Skeleton>

          <Skeleton
            className="mt-1 h-6 [&_[data-slot=skeleton]]:h-[0.875rem] [&_[data-slot=skeleton]]:w-40 [&_[data-slot=skeleton]]:sm:h-3"
            loading={isInitialLoading}
          >
            <TrendIndicator
              change={data?.analytic?.completeRate.change}
              label={`form.analytics.${range}Trend`}
            />
          </Skeleton>
        </div>

        <div className="hf-card p-5">
          <div className="hf-label-muted">{t('form.analytics.averageDuration')}</div>
          <Skeleton
            className="mt-3 h-8 [&_[data-slot=skeleton]]:h-[1.875rem] [&_[data-slot=skeleton]]:w-16 [&_[data-slot=skeleton]]:sm:h-6"
            loading={isInitialLoading}
          >
            <div className="mt-3 text-3xl/8 font-semibold sm:text-2xl/8">
              {toDuration(Math.round(data?.analytic?.averageTime.value || 0))}
            </div>
          </Skeleton>

          <Skeleton
            className="mt-1 h-6 [&_[data-slot=skeleton]]:h-[0.875rem] [&_[data-slot=skeleton]]:w-40 [&_[data-slot=skeleton]]:sm:h-3"
            loading={isInitialLoading}
          >
            <TrendIndicator
              change={data?.analytic?.averageTime.change}
              label={`form.analytics.${range}Trend`}
            />
          </Skeleton>
        </div>
      </div>

      <div className="mt-12 px-6">
        <div className="hf-card overflow-hidden">
          <div className="border-accent-light border-b px-5 py-4">
            <h3 className="text-lg font-semibold">Question journey</h3>
            <p className="text-secondary mt-1 text-sm/6">
              Reach, drop-off, and time-on-question across the selected range.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-accent-light/60 text-secondary">
                <tr>
                  <th className="px-5 py-3 font-medium">Question</th>
                  <th className="px-5 py-3 font-medium">Reach</th>
                  <th className="px-5 py-3 font-medium">Drop-off</th>
                  <th className="px-5 py-3 font-medium">Avg time</th>
                  <th className="px-5 py-3 font-medium">Friction</th>
                </tr>
              </thead>
              <tbody>
                {(data?.questions || []).map((question: any) => (
                  <tr key={question.questionId} className="border-accent-light border-t align-top">
                    <td className="px-5 py-4">
                      <div className="font-medium">{question.title || `Question ${question.order}`}</div>
                      <div className="text-secondary mt-1 text-xs/5">Step {question.order}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium">{toFixed(question.reachRate)}%</div>
                      <div className="text-secondary mt-1 text-xs/5">
                        {question.reachCount} respondents reached this step
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium">{toFixed(question.dropOffRate)}%</div>
                      <div className="text-secondary mt-1 text-xs/5">
                        {question.dropOffCount} respondents left here
                      </div>
                    </td>
                    <td className="px-5 py-4 font-medium">
                      {toDuration(Math.round(question.averageDuration || 0))}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          question.frictionLevel === 'high'
                            ? 'bg-red-100 text-red-700'
                            : question.frictionLevel === 'medium'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {question.frictionLevel} · {question.frictionScore}
                      </span>
                    </td>
                  </tr>
                ))}

                {!isInitialLoading && !(data?.questions || []).length && (
                  <tr>
                    <td className="text-secondary px-5 py-6 text-sm" colSpan={5}>
                      No question journey data yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
