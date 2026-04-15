import { BadRequestException, Injectable } from '@nestjs/common'

import { APP_HOMEPAGE_URL } from '@environments'
import { FormStatusEnum } from '@heyform-inc/shared-types-enums'
import { helper, timestamp, toFixed } from '@heyform-inc/utils'
import { ProjectModel, TeamModel } from '@model'
import {
  buildLeadCapturePayload,
  buildLeadTemplateValues,
  buildTestLeadCapturePayload,
  escapeHtml,
  interpolateLeadTemplate,
  renderLeadTemplateHtml
} from '@utils'

import { ExperimentService } from './experiment.service'
import { FormService } from './form.service'
import { MailService } from './mail.service'
import { ProjectService } from './project.service'
import { SubmissionService } from './submission.service'

const REPORT_SEND_HOUR = 9
const MONTHLY_REPORT_CATCHUP_DAYS = 3
const DAY_IN_SECONDS = 24 * 60 * 60
const RECENT_LEADS_LIMIT = 10
const TOP_FORMS_LIMIT = 5

type LeadReportFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly'
type ActivityTone = 'info' | 'success' | 'warning'
type ProjectEmailOverrides = Record<string, any>

interface SendProjectLeadReportOptions {
  recipientsOverride?: string[]
  persistLastSentAt?: boolean
  skipScheduleCheck?: boolean
  settingsOverride?: ProjectEmailOverrides
}

function hasOwn(overrides: ProjectEmailOverrides | undefined, key: string) {
  return Boolean(overrides && Object.prototype.hasOwnProperty.call(overrides, key))
}

function normalizeOptionalString(value: unknown) {
  if (!helper.isValid(value)) {
    return undefined
  }

  return String(value).trim()
}

function normalizeEmailList(value: unknown): string[] | undefined {
  if (!helper.isArray(value)) {
    return undefined
  }

  const emails = Array.from(
    new Set(
      value
        .filter(helper.isValid)
        .map(email => String(email).trim())
        .filter(Boolean)
    )
  )

  return emails.length > 0 ? emails : []
}

function resolveLeadReportFrequency(value?: unknown): LeadReportFrequency {
  const normalized = normalizeOptionalString(value)?.toLowerCase()

  switch (normalized) {
    case 'daily':
    case 'weekly':
    case 'biweekly':
    case 'monthly':
      return normalized
    default:
      return 'monthly'
  }
}

function formatLeadReportFrequencyLabel(value: LeadReportFrequency) {
  switch (value) {
    case 'daily':
      return 'daily'
    case 'weekly':
      return 'weekly'
    case 'biweekly':
      return 'bi-weekly'
    default:
      return 'monthly'
  }
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function normalizeTimeZone(timeZone?: string) {
  const fallback = 'UTC'

  if (!helper.isValid(timeZone)) {
    return fallback
  }

  try {
    Intl.DateTimeFormat('en-US', {
      timeZone
    }).format(new Date())

    return timeZone!
  } catch {
    return fallback
  }
}

function getZonedParts(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(value)

  const getPart = (type: string) => Number(parts.find(part => part.type === type)?.value || 0)

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hour: getPart('hour')
  }
}

function getDayPeriodKey(value: Date, timeZone: string) {
  const parts = getZonedParts(value, timeZone)

  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function getMonthlyPeriodKey(value: Date, timeZone: string) {
  const parts = getZonedParts(value, timeZone)
  return `${parts.year}-${String(parts.month).padStart(2, '0')}`
}

function shouldSendLeadReport(
  frequency: LeadReportFrequency,
  timeZone: string,
  lastSentAt?: number,
  now = new Date()
) {
  const nowTs = Math.floor(now.getTime() / 1000)
  const parts = getZonedParts(now, timeZone)

  if (frequency === 'monthly') {
    const currentPeriodKey = getMonthlyPeriodKey(now, timeZone)

    if (helper.isValid(lastSentAt)) {
      const lastPeriodKey = getMonthlyPeriodKey(new Date(lastSentAt! * 1000), timeZone)

      if (lastPeriodKey === currentPeriodKey) {
        return false
      }
    }

    if (parts.day === 1) {
      return parts.hour >= REPORT_SEND_HOUR
    }

    return parts.day > 1 && parts.day <= MONTHLY_REPORT_CATCHUP_DAYS
  }

  if (parts.hour < REPORT_SEND_HOUR) {
    return false
  }

  if (!helper.isValid(lastSentAt)) {
    return true
  }

  if (frequency === 'daily') {
    return getDayPeriodKey(now, timeZone) !== getDayPeriodKey(new Date(lastSentAt! * 1000), timeZone)
  }

  const intervalDays = frequency === 'biweekly' ? 14 : 7

  return nowTs - lastSentAt! >= intervalDays * DAY_IN_SECONDS
}

function resolveLeadReportRangeDays(primary?: number, fallback?: number) {
  if (helper.isValid(primary) && primary! > 0) {
    return primary!
  }

  if (helper.isValid(fallback) && fallback! > 0) {
    return fallback!
  }

  return 30
}

function resolveLeadReportRecipients(primary?: string[], legacyProjectRecipients?: string[], fallback?: string[]) {
  const normalizedPrimary = (primary || []).filter(helper.isValid)

  if (normalizedPrimary.length > 0) {
    return normalizedPrimary
  }

  const normalizedLegacyProjectRecipients = (legacyProjectRecipients || []).filter(helper.isValid)

  if (normalizedLegacyProjectRecipients.length > 0) {
    return normalizedLegacyProjectRecipients
  }

  return (fallback || []).filter(helper.isValid)
}

function formatTimestamp(value: number, timeZone: string, includeTime = false) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(includeTime
      ? {
          hour: '2-digit' as const,
          minute: '2-digit' as const,
          hourCycle: 'h23' as const
        }
      : {})
  }).format(new Date(value * 1000))
}

function renderNotificationLayout(title: string, body: string, footer?: string) {
  return `
    <div style="font-family:Arial,sans-serif;background:#f6f8fb;padding:24px;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
        <div style="padding:24px 24px 16px;border-bottom:1px solid #eef2f7;">
          <h1 style="margin:0;font-size:22px;line-height:1.3;color:#111827;">${escapeHtml(title)}</h1>
        </div>
        <div style="padding:24px;color:#111827;font-size:14px;line-height:1.6;">
          ${body}
        </div>
        ${footer ? `<div style="padding:16px 24px;border-top:1px solid #eef2f7;color:#6b7280;font-size:12px;line-height:1.5;">${footer}</div>` : ''}
      </div>
    </div>
  `
}

function renderSummaryCell(label: string, value: string, caption?: string) {
  return `
    <td style="padding:0;vertical-align:top;">
      <div style="border:1px solid #e5e7eb;border-radius:14px;padding:16px;min-height:108px;background:#fafafa;">
        <div style="font-size:12px;line-height:1.4;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(label)}</div>
        <div style="margin-top:10px;font-size:28px;line-height:1.1;color:#111827;font-weight:700;">${escapeHtml(value)}</div>
        ${caption ? `<div style="margin-top:8px;font-size:12px;line-height:1.5;color:#6b7280;">${escapeHtml(caption)}</div>` : ''}
      </div>
    </td>
  `
}

function renderMetricGrid(metrics: Array<{ label: string; value: string; caption?: string }>) {
  const rows = [] as string[]

  for (let index = 0; index < metrics.length; index += 2) {
    const pair = metrics.slice(index, index + 2)
    rows.push(`
      <tr>
        ${pair.map(metric => renderSummaryCell(metric.label, metric.value, metric.caption)).join('')}
        ${pair.length === 1 ? '<td></td>' : ''}
      </tr>
    `)
  }

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:14px 14px;margin:-14px;">
      <tbody>${rows.join('')}</tbody>
    </table>
  `
}

function renderTopForms(topForms: Array<{ name: string; count: number }>) {
  if (!topForms.length) {
    return '<p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6;">No form submissions were recorded in this recap period.</p>'
  }

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <thead>
        <tr>
          <th align="left" style="padding:0 0 10px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid #eef2f7;">Form</th>
          <th align="right" style="padding:0 0 10px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid #eef2f7;">Leads</th>
        </tr>
      </thead>
      <tbody>
        ${topForms
          .map(
            form => `
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-size:14px;line-height:1.5;">${escapeHtml(form.name)}</td>
                <td align="right" style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-size:14px;line-height:1.5;font-weight:600;">${form.count}</td>
              </tr>
            `
          )
          .join('')}
      </tbody>
    </table>
  `
}

function renderRecentLeads(
  recentLeads: Array<{
    formName: string
    respondentName?: string
    respondentEmail?: string
    respondentPhone?: string
    leadLevel?: string
    leadPriority?: string
    leadScore?: number
    submittedAt: number
  }>,
  timeZone: string
) {
  if (!recentLeads.length) {
    return '<p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6;">No recent leads are available for this recap period.</p>'
  }

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <thead>
        <tr>
          <th align="left" style="padding:0 0 10px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid #eef2f7;">Lead</th>
          <th align="left" style="padding:0 0 10px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid #eef2f7;">Form</th>
          <th align="left" style="padding:0 0 10px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid #eef2f7;">Priority</th>
          <th align="right" style="padding:0 0 10px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid #eef2f7;">Submitted</th>
        </tr>
      </thead>
      <tbody>
        ${recentLeads
          .map(lead => {
            const identity = lead.respondentName || lead.respondentEmail || lead.respondentPhone || 'Anonymous lead'
            const contact = lead.respondentEmail || lead.respondentPhone || ''
            const priority = [
              lead.leadPriority,
              lead.leadLevel,
              helper.isValid(lead.leadScore) ? `Score ${lead.leadScore}` : ''
            ]
              .filter(Boolean)
              .join(' | ')

            return `
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;vertical-align:top;">
                  <div style="color:#111827;font-size:14px;line-height:1.5;font-weight:600;">${escapeHtml(identity)}</div>
                  ${contact ? `<div style="color:#6b7280;font-size:12px;line-height:1.5;">${escapeHtml(contact)}</div>` : ''}
                </td>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-size:14px;line-height:1.5;vertical-align:top;">${escapeHtml(lead.formName)}</td>
                <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-size:14px;line-height:1.5;vertical-align:top;">${escapeHtml(priority || 'Unscored')}</td>
                <td align="right" style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:12px;line-height:1.5;vertical-align:top;">${escapeHtml(formatTimestamp(lead.submittedAt, timeZone, true))}</td>
              </tr>
            `
          })
          .join('')}
      </tbody>
    </table>
  `
}

function renderActivityLog(items: Array<{ title: string; body: string; tone?: ActivityTone }>) {
  if (!items.length) {
    return '<p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6;">No notable campaign changes were logged in this recap period.</p>'
  }

  return items
    .map(item => {
      const accentColor =
        item.tone === 'success' ? '#16a34a' : item.tone === 'warning' ? '#d97706' : '#2563eb'

      return `
        <div style="margin-top:12px;border:1px solid #e5e7eb;border-left:4px solid ${accentColor};border-radius:14px;padding:16px 16px 16px 18px;background:#ffffff;">
          <div style="color:#111827;font-size:15px;line-height:1.5;font-weight:600;">${escapeHtml(item.title)}</div>
          <div style="margin-top:6px;color:#4b5563;font-size:14px;line-height:1.6;">${escapeHtml(item.body)}</div>
        </div>
      `
    })
    .join('')
}

function renderLeadReportEmail(options: {
  eyebrow: string
  title: string
  subtitle: string
  messageHtml?: string
  metricGrid: string
  activityLogHtml?: string
  topFormsTable: string
  recentLeadsTable: string
  workspaceUrl: string
}) {
  return `
    <div style="font-family:Arial,sans-serif;background:#f6f8fb;padding:24px;">
      <div style="max-width:880px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;">
        <div style="padding:28px 28px 20px;border-bottom:1px solid #eef2f7;">
          <div style="font-size:12px;line-height:1.4;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(options.eyebrow)}</div>
          <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;color:#111827;">${escapeHtml(options.title)}</h1>
          <p style="margin:10px 0 0;color:#4b5563;font-size:14px;line-height:1.6;">${escapeHtml(options.subtitle)}</p>
        </div>
        <div style="padding:28px;">
          ${options.messageHtml ? `<div style="margin:0 0 24px;color:#111827;font-size:14px;line-height:1.7;">${options.messageHtml}</div>` : ''}
          ${options.metricGrid}
          <div style="margin-top:28px;">
            <h2 style="margin:0 0 14px;color:#111827;font-size:18px;line-height:1.4;">Activity log</h2>
            ${options.activityLogHtml || '<p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6;">No changes were logged in this recap period.</p>'}
          </div>
          <div style="margin-top:28px;">
            <h2 style="margin:0 0 14px;color:#111827;font-size:18px;line-height:1.4;">Form performance</h2>
            ${options.topFormsTable}
          </div>
          <div style="margin-top:28px;">
            <h2 style="margin:0 0 14px;color:#111827;font-size:18px;line-height:1.4;">Recent lead log</h2>
            ${options.recentLeadsTable}
          </div>
          <div style="margin-top:28px;">
            <a href="${options.workspaceUrl}" style="display:inline-block;padding:11px 15px;background:#111827;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;">Open project</a>
          </div>
        </div>
      </div>
    </div>
  `
}

@Injectable()
export class ProjectEmailService {
  constructor(
    private readonly experimentService: ExperimentService,
    private readonly formService: FormService,
    private readonly mailService: MailService,
    private readonly projectService: ProjectService,
    private readonly submissionService: SubmissionService
  ) {}

  async sendProjectLeadReport(
    project: ProjectModel,
    team: TeamModel,
    options: SendProjectLeadReportOptions = {}
  ): Promise<void> {
    const settings = this.resolveSettings(project, options.settingsOverride)
    const recipients =
      options.recipientsOverride && options.recipientsOverride.length > 0
        ? options.recipientsOverride
        : resolveLeadReportRecipients(
            settings.leadReportEmails,
            project.leadNotificationEmails,
            team.leadNotificationEmails
          )
    const timeZone = normalizeTimeZone(settings.reportingTimezone || team.reportingTimezone)
    const frequency = resolveLeadReportFrequency(settings.leadReportFrequency)

    if (recipients.length < 1) {
      return
    }

    if (!options.skipScheduleCheck) {
      if (!settings.enableLeadReport) {
        return
      }

      if (!shouldSendLeadReport(frequency, timeZone, project.leadReportLastSentAt)) {
        return
      }
    }

    const forms = (await this.formService.findAll(project.id, FormStatusEnum.NORMAL)).filter(
      form => !form.suspended
    )
    const endAt = timestamp()
    const startAt = helper.isValid(project.leadReportLastSentAt)
      ? project.leadReportLastSentAt!
      : endAt - resolveLeadReportRangeDays(settings.leadReportRangeDays, team.leadReportRangeDays) * DAY_IN_SECONDS
    const formIds = forms.map(form => form.id)
    const submissions = formIds.length > 0
      ? await this.submissionService.findAllInFormsByDateRange(formIds, startAt, endAt)
      : []
    const sortedSubmissions = [...submissions].sort((left, right) => (right.endAt || 0) - (left.endAt || 0))
    const formMap = new Map(forms.map(form => [form.id, form]))
    const leads = sortedSubmissions
      .map(submission => {
        const form = formMap.get(submission.formId)

        if (!form) {
          return undefined
        }

        return buildLeadCapturePayload(form, submission, team, project)
      })
      .filter(Boolean)
    const scoredLeads = leads.filter(lead => helper.isValid(lead!.leadScore))
    const averageScore = scoredLeads.length
      ? (scoredLeads.reduce((sum, lead) => sum + (lead!.leadScore || 0), 0) / scoredLeads.length).toFixed(1)
      : '0'
    const topForms = Array.from(
      sortedSubmissions.reduce((accumulator, submission) => {
        accumulator.set(submission.formId, (accumulator.get(submission.formId) || 0) + 1)
        return accumulator
      }, new Map<string, number>())
    )
      .map(([formId, count]) => ({
        name: formMap.get(formId)?.name || formId,
        count
      }))
      .sort((left, right) => right.count - left.count)
      .slice(0, TOP_FORMS_LIMIT)
    const recentLeads = leads.slice(0, RECENT_LEADS_LIMIT).map(lead => ({
      formName: lead!.formName,
      respondentName: lead!.respondentName,
      respondentEmail: lead!.respondentEmail,
      respondentPhone: lead!.respondentPhone,
      leadLevel: lead!.leadLevel,
      leadPriority: lead!.leadPriority,
      leadScore: lead!.leadScore,
      submittedAt: lead!.submittedAt
    }))
    const highLeadCount = leads.filter(lead => lead!.leadLevel === 'high').length
    const mediumLeadCount = leads.filter(lead => lead!.leadLevel === 'medium').length
    const lowLeadCount = leads.filter(lead => lead!.leadLevel === 'low').length
    const formsWithLeadsCount = new Set(sortedSubmissions.map(submission => submission.formId)).size
    const projectLabel = helper.isValid(project.name) ? project.name : 'Untitled project'
    const workspaceLabel = helper.isValid(team.clientName) ? team.clientName! : team.name
    const dateRangeLabel = `${formatTimestamp(startAt, timeZone)} - ${formatTimestamp(endAt, timeZone)}`
    const frequencyLabel = formatLeadReportFrequencyLabel(frequency)
    const reportValues = {
      workspaceName: workspaceLabel,
      projectName: projectLabel,
      clientName: helper.isValid(team.clientName) ? team.clientName : undefined,
      leadCount: String(sortedSubmissions.length),
      startDate: formatTimestamp(startAt, timeZone),
      endDate: formatTimestamp(endAt, timeZone),
      dateRange: dateRangeLabel,
      reportingTimezone: timeZone,
      frequency: frequency,
      frequencyLabel,
      activeFormCount: String(forms.length),
      formsWithLeadsCount: String(formsWithLeadsCount),
      averageScore,
      highLeadCount: String(highLeadCount),
      mediumLeadCount: String(mediumLeadCount),
      lowLeadCount: String(lowLeadCount),
      lastReportAt: helper.isValid(project.leadReportLastSentAt)
        ? formatTimestamp(project.leadReportLastSentAt!, timeZone, true)
        : undefined
    }
    const metricGrid = renderMetricGrid([
      {
        label: 'Leads since last recap',
        value: String(sortedSubmissions.length),
        caption: `${forms.length} active forms monitored`
      },
      {
        label: 'Forms with leads',
        value: String(formsWithLeadsCount),
        caption: 'Forms that produced at least one lead'
      },
      {
        label: 'Average score',
        value: averageScore,
        caption: scoredLeads.length ? `${scoredLeads.length} scored submissions` : 'No scored submissions'
      },
      {
        label: 'Priority mix',
        value: `${highLeadCount}/${mediumLeadCount}/${lowLeadCount}`,
        caption: 'High / Medium / Low'
      }
    ])
    const reportStartMs = startAt * 1000
    const reportEndMs = endAt * 1000
    const relevantExperiments = (await this.experimentService.findAllInProject(project.id)).filter(
      experiment => experiment.startAt <= reportEndMs && experiment.endAt >= reportStartMs
    )
    const experimentEntries = await Promise.all(
      relevantExperiments.slice(0, 3).map(async experiment => {
        const evaluation = await this.experimentService.evaluateWinner(experiment)
        const rankedMetrics = [...evaluation.metrics].sort((left, right) => {
          if (right.conversionRate !== left.conversionRate) {
            return right.conversionRate - left.conversionRate
          }

          if (right.submissions !== left.submissions) {
            return right.submissions - left.submissions
          }

          return left.averageTime - right.averageTime
        })
        const leader = rankedMetrics[0]
        const leaderName = leader ? formMap.get(leader.formId)?.name || leader.formId : 'No leading form yet'

        if (evaluation.winnerFormId && leader) {
          return {
            title: `A/B result: ${experiment.name}`,
            body: `${leaderName} led with ${toFixed(leader.conversionRate)}% conversion from ${leader.visits} visits and ${leader.submissions} submissions.`,
            tone: 'success' as const
          }
        }

        if (experiment.status === 'running' && leader) {
          return {
            title: `A/B test still running: ${experiment.name}`,
            body: `Traffic is still split across ${rankedMetrics.length} variants. Current leader: ${leaderName} at ${toFixed(leader.conversionRate)}% conversion from ${leader.visits} visits.`,
            tone: 'info' as const
          }
        }

        return {
          title: `A/B test completed: ${experiment.name}`,
          body:
            evaluation.promotionBlockedReason ||
            'The test window closed without a promotable winner in this recap period.',
          tone: 'warning' as const
        }
      })
    )
    const activityLog = renderActivityLog(
      [
        formsWithLeadsCount > 1
          ? {
              title: 'Multiple forms were live in this recap period',
              body: `${formsWithLeadsCount} forms captured leads between ${dateRangeLabel}. Top contributors: ${topForms
                .slice(0, 3)
                .map(form => `${form.name} (${form.count})`)
                .join(', ')}.`,
              tone: 'info' as const
            }
          : topForms[0]
            ? {
                title: 'One form drove the campaign window',
                body: `${topForms[0].name} generated ${topForms[0].count} submissions in this recap period.`,
                tone: 'info' as const
              }
            : undefined,
        ...experimentEntries
      ].filter(Boolean) as Array<{ title: string; body: string; tone?: ActivityTone }>
    )
    const subject = interpolateLeadTemplate(
      settings.leadReportSubject || '{projectName} {frequencyLabel} lead recap - {dateRange}',
      reportValues
    )
    const messageHtml = renderLeadTemplateHtml(
      settings.leadReportMessage ||
        'Since the last recap, {leadCount} leads were received for {projectName}. This summary covers {startDate} to {endDate} in {reportingTimezone}.',
      reportValues
    )

    await this.mailService.sendDirect(recipients, {
      subject,
      html: renderLeadReportEmail({
        eyebrow: `${capitalize(frequencyLabel)} campaign recap`,
        title: projectLabel,
        subtitle: `${workspaceLabel} | ${dateRangeLabel} | Timezone ${timeZone}`,
        messageHtml,
        metricGrid,
        activityLogHtml: activityLog,
        topFormsTable: renderTopForms(topForms),
        recentLeadsTable: renderRecentLeads(recentLeads, timeZone),
        workspaceUrl: `${APP_HOMEPAGE_URL}/workspace/${team.id}/project/${project.id}`
      })
    })

    if (options.persistLastSentAt !== false) {
      await this.projectService.update(project.id, {
        leadReportLastSentAt: endAt
      })
    }
  }

  async sendProjectRespondentTestEmail(
    project: ProjectModel,
    team: TeamModel,
    recipientEmail: string,
    settingsOverride?: ProjectEmailOverrides
  ): Promise<void> {
    if (!helper.isValid(recipientEmail)) {
      throw new BadRequestException('A valid recipient email is required')
    }

    const settings = this.resolveSettings(project, settingsOverride)
    const forms = (await this.formService.findAll(project.id, FormStatusEnum.NORMAL)).filter(
      form => !form.suspended
    )
    const activeForm = forms[0]
    const payload = activeForm
      ? {
          ...buildTestLeadCapturePayload(activeForm, team),
          projectId: project.id,
          projectName: project.name,
          respondentEmail: recipientEmail,
          reportingTimezone: normalizeOptionalString(project.reportingTimezone || team.reportingTimezone)
        }
      : this.buildFallbackConfirmationPayload(project, team, recipientEmail)
    const values = buildLeadTemplateValues(payload, {
      workspaceName: team.name,
      projectName: project.name
    })
    const subject = interpolateLeadTemplate(
      settings.respondentNotificationSubject || 'We received your submission for {formName}',
      values
    )
    const body = renderLeadTemplateHtml(
      settings.respondentNotificationMessage ||
        'Hi {respondentName},\n\nThanks for your submission to {formName}. We received it on {submittedAt}. A team member will review it and follow up if needed.',
      values
    )

    await this.mailService.sendDirect(recipientEmail, {
      subject,
      html: renderNotificationLayout(
        subject,
        `${body}<div style="margin-top:20px;color:#6b7280;font-size:12px;">Reference: ${escapeHtml(
          payload.submissionId
        )}</div>`,
        [
          helper.isValid(team.clientName) ? `Client: ${escapeHtml(team.clientName!)}` : undefined,
          helper.isValid(project.name) ? `Project: ${escapeHtml(project.name)}` : undefined
        ]
          .filter(Boolean)
          .join(' | ') || undefined
      )
    })
  }

  private buildFallbackConfirmationPayload(project: ProjectModel, team: TeamModel, recipientEmail: string) {
    const submittedAt = timestamp()

    return {
      clientName: normalizeOptionalString(team.clientName),
      formId: 'project-preview',
      formName: helper.isValid(project.name) ? `${project.name} campaign` : 'Campaign',
      projectId: project.id,
      projectName: normalizeOptionalString(project.name),
      submissionId: `project-preview-${submittedAt}`,
      userId: `lead_preview_${submittedAt}`,
      userIdSource: 'submission' as const,
      submittedAt,
      submittedAtIso: new Date(submittedAt * 1000).toISOString(),
      respondentName: 'Sample Lead',
      respondentEmail: recipientEmail,
      respondentPhone: '+447700900123',
      leadScore: 72,
      leadScoreVariableId: undefined,
      leadScoreVariableName: 'Lead Score',
      leadLevel: 'medium' as const,
      leadQuality: 'Review',
      leadPriority: 'Warm',
      answersByTitle: {
        'What’s your first name?': 'Sample Lead',
        'Best email address?': recipientEmail
      },
      hiddenFieldsByName: {},
      variablesByName: {
        'Lead Score': 72
      },
      answersPlain: `What’s your first name?\nSample Lead\n\nBest email address?\n${recipientEmail}`,
      answersHtml: `What’s your first name?<br />Sample Lead<br /><br />Best email address?<br />${escapeHtml(recipientEmail)}`,
      reportingTimezone: normalizeOptionalString(project.reportingTimezone || team.reportingTimezone)
    }
  }

  private resolveSettings(project: ProjectModel, overrides?: ProjectEmailOverrides) {
    return {
      leadReportEmails: hasOwn(overrides, 'leadReportEmails')
        ? normalizeEmailList(overrides?.leadReportEmails)
        : project.leadReportEmails,
      enableRespondentNotification: hasOwn(overrides, 'enableRespondentNotification')
        ? Boolean(overrides?.enableRespondentNotification)
        : project.enableRespondentNotification,
      respondentNotificationSubject: hasOwn(overrides, 'respondentNotificationSubject')
        ? normalizeOptionalString(overrides?.respondentNotificationSubject)
        : project.respondentNotificationSubject,
      respondentNotificationMessage: hasOwn(overrides, 'respondentNotificationMessage')
        ? normalizeOptionalString(overrides?.respondentNotificationMessage)
        : project.respondentNotificationMessage,
      enableLeadReport: hasOwn(overrides, 'enableLeadReport')
        ? Boolean(overrides?.enableLeadReport)
        : project.enableLeadReport,
      leadReportFrequency: hasOwn(overrides, 'leadReportFrequency')
        ? normalizeOptionalString(overrides?.leadReportFrequency)
        : project.leadReportFrequency,
      leadReportRangeDays: hasOwn(overrides, 'leadReportRangeDays') && helper.isValid(overrides?.leadReportRangeDays)
        ? Number(overrides?.leadReportRangeDays)
        : project.leadReportRangeDays,
      leadReportSubject: hasOwn(overrides, 'leadReportSubject')
        ? normalizeOptionalString(overrides?.leadReportSubject)
        : project.leadReportSubject,
      leadReportMessage: hasOwn(overrides, 'leadReportMessage')
        ? normalizeOptionalString(overrides?.leadReportMessage)
        : project.leadReportMessage,
      reportingTimezone: hasOwn(overrides, 'reportingTimezone')
        ? normalizeOptionalString(overrides?.reportingTimezone)
        : project.reportingTimezone
    }
  }
}