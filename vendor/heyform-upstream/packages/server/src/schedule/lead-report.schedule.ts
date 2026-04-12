import { Process, Processor } from '@nestjs/bull'

import { APP_HOMEPAGE_URL } from '@environments'
import { FormStatusEnum } from '@heyform-inc/shared-types-enums'
import { date, helper, timestamp } from '@heyform-inc/utils'
import { TeamModel } from '@model'
import { FormService, MailService, SubmissionService, TeamService } from '@service'
import { buildLeadCapturePayload, escapeHtml } from '@utils'

import { BaseQueue } from '../queue/base.queue'

const MONTHLY_REPORT_SEND_HOUR = 9
const MONTHLY_REPORT_CATCHUP_DAYS = 3
const RECENT_LEADS_LIMIT = 10
const TOP_FORMS_LIMIT = 5

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

function getMonthlyPeriodKey(value: Date, timeZone: string) {
  const parts = getZonedParts(value, timeZone)
  return `${parts.year}-${String(parts.month).padStart(2, '0')}`
}

function shouldSendMonthlyReport(timeZone: string, lastSentAt?: number, now = new Date()) {
  const parts = getZonedParts(now, timeZone)
  const currentPeriodKey = getMonthlyPeriodKey(now, timeZone)

  if (helper.isValid(lastSentAt)) {
    const lastPeriodKey = getMonthlyPeriodKey(new Date(lastSentAt! * 1000), timeZone)

    if (lastPeriodKey === currentPeriodKey) {
      return false
    }
  }

  if (parts.day === 1) {
    return parts.hour >= MONTHLY_REPORT_SEND_HOUR
  }

  return parts.day > 1 && parts.day <= MONTHLY_REPORT_CATCHUP_DAYS
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
    return '<p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6;">No form submissions were recorded in this period.</p>'
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
    return '<p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6;">No recent leads are available for this period.</p>'
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
            const priority = [lead.leadPriority, lead.leadLevel, helper.isValid(lead.leadScore) ? `Score ${lead.leadScore}` : '']
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

function renderLeadReportEmail(options: {
  title: string
  subtitle: string
  metricGrid: string
  topFormsTable: string
  recentLeadsTable: string
  workspaceUrl: string
}) {
  return `
    <div style="font-family:Arial,sans-serif;background:#f6f8fb;padding:24px;">
      <div style="max-width:880px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;">
        <div style="padding:28px 28px 20px;border-bottom:1px solid #eef2f7;">
          <div style="font-size:12px;line-height:1.4;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Monthly lead report</div>
          <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;color:#111827;">${escapeHtml(options.title)}</h1>
          <p style="margin:10px 0 0;color:#4b5563;font-size:14px;line-height:1.6;">${escapeHtml(options.subtitle)}</p>
        </div>
        <div style="padding:28px;">
          ${options.metricGrid}
          <div style="margin-top:28px;">
            <h2 style="margin:0 0 14px;color:#111827;font-size:18px;line-height:1.4;">Top forms</h2>
            ${options.topFormsTable}
          </div>
          <div style="margin-top:28px;">
            <h2 style="margin:0 0 14px;color:#111827;font-size:18px;line-height:1.4;">Recent leads</h2>
            ${options.recentLeadsTable}
          </div>
          <div style="margin-top:28px;">
            <a href="${options.workspaceUrl}" style="display:inline-block;padding:11px 15px;background:#111827;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;">Open workspace</a>
          </div>
        </div>
      </div>
    </div>
  `
}

@Processor('LeadReportSchedule')
export class LeadReportSchedule extends BaseQueue {
  constructor(
    private readonly teamService: TeamService,
    private readonly formService: FormService,
    private readonly submissionService: SubmissionService,
    private readonly mailService: MailService
  ) {
    super()
  }

  @Process()
  async process(): Promise<void> {
    const teams = await this.teamService.findAllBy({
      enableLeadReport: true
    })

    for (const team of teams) {
      try {
        await this.sendMonthlyLeadReport(team)
      } catch (error) {
        this.logger.trace(
          `LeadReportSchedule failed for workspace ${team.id}`,
          error instanceof Error ? error.stack : undefined
        )
      }
    }
  }

  private async sendMonthlyLeadReport(team: TeamModel): Promise<void> {
    const recipients = (team.leadNotificationEmails || []).filter(helper.isValid)
    const timeZone = normalizeTimeZone(team.reportingTimezone)

    if (!team.enableLeadReport || recipients.length < 1) {
      return
    }

    if (!shouldSendMonthlyReport(timeZone, team.leadReportLastSentAt)) {
      return
    }

    const forms = (await this.formService.findAllInTeam(team.id)).filter(
      form => form.status === FormStatusEnum.NORMAL && !form.suspended
    )
    const rangeDays =
      helper.isValid(team.leadReportRangeDays) && team.leadReportRangeDays! > 0
        ? team.leadReportRangeDays!
        : 30
    const endAt = timestamp()
    const startAt = date().subtract(rangeDays, 'days').unix()
    const formIds = forms.map(form => form.id)
    const submissions = await this.submissionService.findAllInFormsByDateRange(formIds, startAt, endAt)
    const formMap = new Map(forms.map(form => [form.id, form]))
    const leads = submissions
      .map(submission => {
        const form = formMap.get(submission.formId)

        if (!form) {
          return undefined
        }

        return buildLeadCapturePayload(form, submission, team)
      })
      .filter(Boolean)
    const scoredLeads = leads.filter(lead => helper.isValid(lead!.leadScore))
    const averageScore = scoredLeads.length
      ? (scoredLeads.reduce((sum, lead) => sum + (lead!.leadScore || 0), 0) / scoredLeads.length).toFixed(1)
      : '0'
    const topForms = Array.from(
      submissions.reduce((accumulator, submission) => {
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
    const metricGrid = renderMetricGrid([
      {
        label: 'Total leads',
        value: String(submissions.length),
        caption: `${forms.length} active forms monitored`
      },
      {
        label: 'Forms with leads',
        value: String(new Set(submissions.map(submission => submission.formId)).size),
        caption: 'Forms that produced at least one lead'
      },
      {
        label: 'Average score',
        value: averageScore,
        caption: scoredLeads.length ? `${scoredLeads.length} scored submissions` : 'No scored submissions'
      },
      {
        label: 'Priority mix',
        value: `${leads.filter(lead => lead!.leadLevel === 'high').length}/${leads.filter(lead => lead!.leadLevel === 'medium').length}/${leads.filter(lead => lead!.leadLevel === 'low').length}`,
        caption: 'High / Medium / Low'
      }
    ])
    const workspaceLabel = helper.isValid(team.clientName) ? team.clientName! : team.name
    const dateRangeLabel = `${formatTimestamp(startAt, timeZone)} - ${formatTimestamp(endAt, timeZone)}`
    const workspaceUrl = `${APP_HOMEPAGE_URL}/workspace/${team.id}`

    await this.mailService.sendDirect(recipients, {
      subject: `${workspaceLabel} monthly lead report - ${dateRangeLabel}`,
      html: renderLeadReportEmail({
        title: workspaceLabel,
        subtitle: `${dateRangeLabel} | Timezone ${timeZone}`,
        metricGrid,
        topFormsTable: renderTopForms(topForms),
        recentLeadsTable: renderRecentLeads(recentLeads, timeZone),
        workspaceUrl
      })
    })

    await this.teamService.update(team.id, {
      leadReportLastSentAt: endAt
    })
  }
}
