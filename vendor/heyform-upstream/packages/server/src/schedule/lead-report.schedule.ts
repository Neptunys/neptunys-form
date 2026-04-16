import { Process, Processor } from '@nestjs/bull'

import { APP_HOMEPAGE_URL } from '@environments'
import { FormStatusEnum } from '@heyform-inc/shared-types-enums'
import { date, helper, timestamp } from '@heyform-inc/utils'
import { ProjectModel, TeamModel } from '@model'
import {
  FormService,
  MailService,
  ProjectEmailService,
  ProjectService,
  SubmissionService,
  TeamService
} from '@service'
import { buildLeadCapturePayload, escapeHtml } from '@utils'

import { BaseQueue } from '../queue/base.queue'

const MONTHLY_REPORT_SEND_HOUR = 9
const MONTHLY_REPORT_CATCHUP_DAYS = 3
const RECENT_LEADS_LIMIT = 10
const TOP_FORMS_LIMIT = 5

function resolveLeadReportRecipients(primary?: string[], fallback?: string[]) {
  const normalizedPrimary = (primary || []).filter(helper.isValid)

  if (normalizedPrimary.length > 0) {
    return normalizedPrimary
  }

  return (fallback || []).filter(helper.isValid)
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

function hasOwn(overrides: Record<string, any> | undefined, key: string) {
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

function renderActivityLog(
  items: Array<{
    title: string
    body: string
    tone?: 'info' | 'success' | 'warning'
  }>
) {
  if (!items.length) {
    return '<p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6;">No routing, experiment, or volume changes were logged for this period.</p>'
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
  title: string
  subtitle: string
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
          <div style="font-size:12px;line-height:1.4;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Monthly client report</div>
          <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;color:#111827;">${escapeHtml(options.title)}</h1>
          <p style="margin:10px 0 0;color:#4b5563;font-size:14px;line-height:1.6;">${escapeHtml(options.subtitle)}</p>
        </div>
        <div style="padding:28px;">
          ${options.metricGrid}
          <div style="margin-top:28px;">
            <h2 style="margin:0 0 14px;color:#111827;font-size:18px;line-height:1.4;">Activity log</h2>
            ${options.activityLogHtml || '<p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6;">No changes were logged in this period.</p>'}
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
            <a href="${options.workspaceUrl}" style="display:inline-block;padding:11px 15px;background:#111827;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;">Open workspace</a>
          </div>
        </div>
      </div>
    </div>
  `
}

interface SendWorkspaceLeadReportOptions {
  persistLastSentAt?: boolean
  skipScheduleCheck?: boolean
  requireRecipients?: boolean
  settingsOverride?: Record<string, any>
}

@Processor('LeadReportSchedule')
export class LeadReportSchedule extends BaseQueue {
  constructor(
    private readonly teamService: TeamService,
    private readonly projectService: ProjectService,
    private readonly projectEmailService: ProjectEmailService,
    private readonly formService: FormService,
    private readonly submissionService: SubmissionService,
    private readonly mailService: MailService
  ) {
    super()
  }

  private resolveTeamSettings(team: TeamModel, overrides?: Record<string, any>) {
    return {
      clientName: hasOwn(overrides, 'clientName')
        ? normalizeOptionalString(overrides?.clientName)
        : team.clientName,
      leadNotificationEmails: hasOwn(overrides, 'leadNotificationEmails')
        ? normalizeEmailList(overrides?.leadNotificationEmails)
        : team.leadNotificationEmails,
      enableLeadReport: hasOwn(overrides, 'enableLeadReport')
        ? Boolean(overrides?.enableLeadReport)
        : team.enableLeadReport,
      leadReportRangeDays:
        hasOwn(overrides, 'leadReportRangeDays') && helper.isValid(overrides?.leadReportRangeDays)
          ? Number(overrides?.leadReportRangeDays)
          : team.leadReportRangeDays,
      reportingTimezone: hasOwn(overrides, 'reportingTimezone')
        ? normalizeOptionalString(overrides?.reportingTimezone)
        : team.reportingTimezone
    }
  }

  @Process()
  async process(): Promise<void> {
    const [teams, projects] = await Promise.all([
      this.teamService.findAllBy({
        enableLeadReport: true
      }),
      this.projectService.findAllBy({
        enableLeadReport: true
      })
    ])
    const teamMap = new Map(teams.map(team => [team.id, team]))
    const missingTeamIds = Array.from(
      new Set(projects.map(project => project.teamId).filter(teamId => !teamMap.has(teamId)))
    )

    if (missingTeamIds.length > 0) {
      const projectTeams = await this.teamService.findAllBy({
        _id: {
          $in: missingTeamIds
        }
      })

      projectTeams.forEach(team => {
        teamMap.set(team.id, team)
      })
    }

    for (const team of teams) {
      try {
        await this.sendWorkspaceLeadReport(team)
      } catch (error) {
        this.logger.trace(
          `LeadReportSchedule failed for workspace ${team.id}`,
          error instanceof Error ? error.stack : undefined
        )
      }
    }

    for (const project of projects) {
      const team = teamMap.get(project.teamId)

      if (!team) {
        continue
      }

      try {
        await this.sendProjectLeadReport(project, team)
      } catch (error) {
        this.logger.trace(
          `LeadReportSchedule failed for project ${project.id}`,
          error instanceof Error ? error.stack : undefined
        )
      }
    }
  }

  async sendWorkspaceLeadReport(
    team: TeamModel,
    options: SendWorkspaceLeadReportOptions = {}
  ): Promise<void> {
    const settings = this.resolveTeamSettings(team, options.settingsOverride)
    const recipients = resolveLeadReportRecipients(settings.leadNotificationEmails)
    const timeZone = normalizeTimeZone(settings.reportingTimezone)

    if (recipients.length < 1) {
      if (options.requireRecipients) {
        throw new Error('Add at least one default lead recipient before sending a report')
      }

      return
    }

    if (!options.skipScheduleCheck) {
      if (!settings.enableLeadReport) {
        return
      }

      if (!shouldSendMonthlyReport(timeZone, team.leadReportLastSentAt)) {
        return
      }
    }

    const effectiveTeam = {
      ...team,
      clientName: settings.clientName,
      leadNotificationEmails: settings.leadNotificationEmails,
      enableLeadReport: settings.enableLeadReport,
      leadReportRangeDays: settings.leadReportRangeDays,
      reportingTimezone: settings.reportingTimezone
    } as TeamModel

    const forms = (await this.formService.findAllInTeam(team.id)).filter(
      form => form.status === FormStatusEnum.NORMAL && !form.suspended
    )
    const rangeDays = resolveLeadReportRangeDays(settings.leadReportRangeDays)
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

        return buildLeadCapturePayload(form, submission, effectiveTeam)
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
    const workspaceLabel = helper.isValid(settings.clientName) ? settings.clientName! : team.name
    const dateRangeLabel = `${formatTimestamp(startAt, timeZone)} - ${formatTimestamp(endAt, timeZone)}`
    const workspaceUrl = `${APP_HOMEPAGE_URL}/workspace/${team.id}`
    const formsWithLeadsCount = new Set(submissions.map(submission => submission.formId)).size
    const workspaceActivityLog = renderActivityLog([
      formsWithLeadsCount > 1
        ? {
            title: 'Multiple forms generated leads',
            body: `${formsWithLeadsCount} forms produced submissions in this window. Top contributors: ${topForms
              .slice(0, 3)
              .map(form => `${form.name} (${form.count})`)
              .join(', ')}.`,
            tone: 'info' as const
          }
        : topForms[0]
          ? {
              title: 'One form drove the reporting period',
              body: `${topForms[0].name} generated ${topForms[0].count} submissions in this window.`,
              tone: 'info' as const
            }
          : undefined
    ].filter(Boolean) as Array<{ title: string; body: string; tone?: 'info' | 'success' | 'warning' }>)

    await this.mailService.sendDirect(recipients, {
      subject: `${workspaceLabel} monthly lead report - ${dateRangeLabel}`,
      html: renderLeadReportEmail({
        title: workspaceLabel,
        subtitle: `${dateRangeLabel} | Timezone ${timeZone}`,
        metricGrid,
        activityLogHtml: workspaceActivityLog,
        topFormsTable: renderTopForms(topForms),
        recentLeadsTable: renderRecentLeads(recentLeads, timeZone),
        workspaceUrl
      })
    })

    if (options.persistLastSentAt !== false) {
      await this.teamService.update(team.id, {
        leadReportLastSentAt: endAt
      })
    }
  }

  private async sendProjectLeadReport(project: ProjectModel, team: TeamModel): Promise<void> {
    await this.projectEmailService.sendProjectLeadReport(project, team)
  }
}
