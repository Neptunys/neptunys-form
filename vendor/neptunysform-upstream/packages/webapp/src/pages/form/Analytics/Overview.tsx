import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-react'
import { useRequest } from 'ahooks'
import { FC, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FormService } from '@/services'
import { useParam } from '@/utils'
import { date, helper, toDuration, toFixed } from '@neptunysform-inc/utils'

import { Button, Checkbox, Input, Select, Skeleton, useAlert, useToast } from '@/components'

interface TrendIndicatorProps {
  change?: number | null
  text: string
}

const SOURCE_CHANNEL_OPTIONS = [
  {
    label: 'All sources',
    value: 'all'
  },
  {
    label: 'Direct link',
    value: 'direct'
  },
  {
    label: 'Meta',
    value: 'meta'
  },
  {
    label: 'Google',
    value: 'google'
  },
  {
    label: 'LinkedIn',
    value: 'linkedin'
  },
  {
    label: 'X',
    value: 'x'
  },
  {
    label: 'YouTube',
    value: 'youtube'
  },
  {
    label: 'TikTok',
    value: 'tiktok'
  },
  {
    label: 'Email',
    value: 'email'
  },
  {
    label: 'Other',
    value: 'other'
  }
]

const SOURCE_CHANNEL_LABELS = SOURCE_CHANNEL_OPTIONS.reduce<Record<string, string>>((acc, option) => {
  acc[option.value] = option.label
  return acc
}, {})

function getTrendText(t: (key: string, options?: Record<string, any>) => string, range: string, change?: number | null) {
  if (helper.isNil(change)) {
    return ''
  }

  const formattedChange = `${change > 0 ? '+' : ''}${toFixed(change)}`

  if (range === 'today') {
    return `${formattedChange}% from yesterday`
  }

  if (range === 'custom') {
    return `${formattedChange}% from the previous period`
  }

  return t(`form.analytics.${range}Trend`, {
    change: formattedChange
  })
}

const TrendIndicator: FC<TrendIndicatorProps> = ({ change, text }) => {
  if (helper.isNil(change)) {
    return null
  }

  return (
    <div className="mt-1 flex items-center gap-1.5 text-sm/6 sm:text-xs/6">
      {change! > 0 ? (
        <IconTrendingUp className="h-4 w-4 text-green-600" />
      ) : (
        <IconTrendingDown className="h-4 w-4 text-red-600" />
      )}
      <span className="text-secondary">{text}</span>
    </div>
  )
}

export default function FormAnalyticsOverview() {
  const { t } = useTranslation()

  const { formId } = useParam()
  const toast = useToast()
  const alert = useAlert()
  const defaultCustomEnd = date().format('YYYY-MM-DD')
  const defaultCustomStart = date().subtract(6, 'days').format('YYYY-MM-DD')
  const [range, setRange] = useState('7d')
  const [sourceChannel, setSourceChannel] = useState('all')
  const [dedupeByIp, setDedupeByIp] = useState(false)
  const [startDate, setStartDate] = useState(defaultCustomStart)
  const [endDate, setEndDate] = useState(defaultCustomEnd)
  const [downloadLoading, setDownloadLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const isCustomRange = range === 'custom'
  const analyticRanges = useMemo(
    () => [
      {
        label: 'Today',
        value: 'today'
      },
      {
        label: t('form.analytics.7d'),
        value: '7d'
      },
      {
        label: t('form.analytics.1m'),
        value: '1m'
      },
      {
        label: t('form.analytics.3m'),
        value: '3m'
      },
      {
        label: t('form.analytics.6m'),
        value: '6m'
      },
      {
        label: t('form.analytics.1y'),
        value: '1y'
      },
      {
        label: 'Custom range',
        value: 'custom'
      }
    ],
    [t]
  )

  const { loading, data, refreshAsync } = useRequest(
    async () => {
      const [analytic, questions] = await Promise.all([
        FormService.analytic(formId, range, {
          sourceChannel,
          dedupeByIp,
          startDate,
          endDate
        }),
        FormService.questionAnalytics(formId, range, {
          sourceChannel,
          dedupeByIp,
          startDate,
          endDate
        })
      ])

      return {
        analytic,
        questions
      }
    },
    {
      refreshDeps: [dedupeByIp, endDate, formId, range, sourceChannel, startDate],
      refreshOnWindowFocus: false
    }
  )
  const isInitialLoading = loading && !data

  async function handleDownloadAnalytics() {
    if (isCustomRange && (!helper.isValid(startDate) || !helper.isValid(endDate))) {
      toast({
        title: t('components.error.title'),
        message: 'Choose a valid custom date range before downloading analytics.'
      })
      return
    }

    if (isCustomRange && startDate > endDate) {
      toast({
        title: t('components.error.title'),
        message: 'The custom start date must be on or before the end date.'
      })
      return
    }

    setDownloadLoading(true)

    try {
      await FormService.downloadAnalytics(formId, range, {
        sourceChannel,
        dedupeByIp,
        startDate,
        endDate
      })
    } catch (error: any) {
      toast({
        title: t('components.error.title'),
        message: error.message || 'Unable to download the analytics workbook.'
      })
    } finally {
      setDownloadLoading(false)
    }
  }

  function handleResetAnalytics() {
    alert({
      title: 'Reset analytics data?',
      description:
        'This will reset visits, source attribution, and question journey metrics for this form from now on. Submissions stay intact and cannot be restored in analytics.',
      cancelProps: {
        label: t('components.cancel')
      },
      confirmProps: {
        label: 'Reset analytics',
        className: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
      },
      async onConfirm() {
        setResetLoading(true)

        try {
          await FormService.resetAnalytics(formId)
          await refreshAsync()

          toast({
            title: 'Analytics reset',
            message: 'Analytics counters were reset for this form.'
          })
        } catch (error: any) {
          toast({
            title: t('components.error.title'),
            message: error.message || 'Unable to reset analytics right now.'
          })
        } finally {
          setResetLoading(false)
        }
      }
    })
  }

  return (
    <>
      <div className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <h2 className="hf-section-title ml-6">{t('dashboard.overview')}</h2>
        <div className="mr-6 flex w-full flex-col gap-2 sm:w-auto sm:items-end">
          <label className="text-secondary flex items-center gap-2 text-sm/6">
            <Checkbox value={dedupeByIp} disabled={isInitialLoading} onChange={setDedupeByIp} />
            <span>Count one visit and one submission per IP</span>
          </label>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              size="sm"
              loading={resetLoading}
              disabled={isInitialLoading || downloadLoading}
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleResetAnalytics}
            >
              Reset analytics
            </Button>
            <Select
              className="w-full sm:w-44"
              value={sourceChannel}
              options={SOURCE_CHANNEL_OPTIONS}
              placeholder="All sources"
              disabled={isInitialLoading}
              onChange={setSourceChannel}
            />
            <Select
              className="w-full sm:w-40"
              value={range}
              options={analyticRanges}
              placeholder="Range"
              disabled={isInitialLoading}
              onChange={setRange}
            />
          </div>
          <Button size="sm" loading={downloadLoading} disabled={isInitialLoading} onClick={handleDownloadAnalytics}>
            Download XLSX
          </Button>
          {isCustomRange && (
            <div className="grid w-full gap-2 sm:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-secondary text-xs font-medium uppercase tracking-wide">From</span>
                <Input type="date" value={startDate} disabled={isInitialLoading} onChange={setStartDate} />
              </label>
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-secondary text-xs font-medium uppercase tracking-wide">To</span>
                <Input type="date" value={endDate} disabled={isInitialLoading} onChange={setEndDate} />
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 px-6">
        <div className="hf-card p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="hf-label-muted">Source mix</div>
              <p className="text-secondary mt-2 text-sm/6">
                {sourceChannel === 'all'
                  ? 'Visits and submissions grouped by access channel for the selected range.'
                  : `Filtered to ${SOURCE_CHANNEL_LABELS[sourceChannel] || sourceChannel}.`}
              </p>
            </div>
            {dedupeByIp && (
              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                Unique IP mode
              </span>
            )}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(data?.analytic?.sourceBreakdown || []).map((row: any) => (
              <div key={row.channel} className="hf-card-muted flex min-h-[5.5rem] flex-col justify-between p-4">
                <div className="text-primary text-sm font-semibold">
                  {SOURCE_CHANNEL_LABELS[row.channel] || row.channel}
                </div>
                <div className="space-y-0.5">
                  <div className="text-secondary text-xs/5">{row.totalVisits} visits</div>
                  <div className="text-secondary text-xs/5">{row.submissionCount} submissions</div>
                </div>
              </div>
            ))}

            {!isInitialLoading && !(data?.analytic?.sourceBreakdown || []).length && (
              <div className="hf-card-muted text-secondary border-dashed p-4 text-sm">
                No source data yet for this range.
              </div>
            )}
          </div>
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
              text={getTrendText(t, range, data?.analytic?.totalVisits.change)}
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
              text={getTrendText(t, range, data?.analytic?.submissionCount.change)}
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
              text={getTrendText(t, range, data?.analytic?.completeRate.change)}
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
              text={getTrendText(t, range, data?.analytic?.averageTime.change)}
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
              {dedupeByIp ? ' One representative session per IP is counted.' : ''}
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
                        className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 ${
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
