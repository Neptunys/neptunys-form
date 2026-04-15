import { Process, Processor } from '@nestjs/bull'
import { Job } from 'bull'

import { APP_HOMEPAGE_URL } from '@environments'
import { helper } from '@heyform-inc/utils'
import { FormService, MailService, ProjectService, SubmissionService, TeamService, UserService } from '@service'
import {
  buildLeadCapturePayload,
  buildLeadTemplateValues,
  escapeHtml,
  interpolateLeadTemplate,
  renderLeadTemplateHtml
} from '@utils'

import { BaseQueue, IntegrationQueueJob } from './base.queue'

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

function getUniqueEmails(...groups: Array<string[] | undefined>) {
  return Array.from(
    new Set(
      groups
        .flat()
        .filter((email): email is string => helper.isValid(email))
        .map(email => email.trim())
    )
  )
}

function resolveInheritedRecipients(primary?: string[], fallback?: string[]) {
  const normalizedPrimary = (primary || []).filter(helper.isValid)

  if (normalizedPrimary.length > 0) {
    return normalizedPrimary
  }

  return (fallback || []).filter(helper.isValid)
}

@Processor('SubmissionNotificationQueue')
export class SubmissionNotificationQueue extends BaseQueue {
  constructor(
    private readonly submissionService: SubmissionService,
    private readonly mailService: MailService,
    private readonly formService: FormService,
    private readonly userService: UserService,
    private readonly teamService: TeamService,
    private readonly projectService: ProjectService
  ) {
    super()
  }

  @Process()
  async process(job: Job<IntegrationQueueJob>): Promise<any> {
    const [submission, form] = await Promise.all([
      this.submissionService.findById(job.data.submissionId),
      this.formService.findById(job.data.formId)
    ])

    const [user, team, project] = await Promise.all([
      this.userService.findById(form.memberId),
      this.teamService.findById(form.teamId),
      this.projectService.findById(form.projectId)
    ])

    const resolvedTimezone = project?.reportingTimezone || team?.reportingTimezone
    const inheritedProjectRecipients = resolveInheritedRecipients(
      project?.leadNotificationEmails,
      team?.leadNotificationEmails
    )
    const formSettings = ((form.settings || {}) as Record<string, any>) || {}
    const payload = buildLeadCapturePayload(form, submission, team || undefined, project || undefined)
    const submissionLink = `${APP_HOMEPAGE_URL}/workspace/${form.teamId}/project/${form.projectId}/form/${form.id}/submissions`
    const values = buildLeadTemplateValues(payload, {
      workspaceName: team?.name,
      projectName: project?.name,
      submissionLink
    })

    if (user?.email && formSettings.enableEmailNotification) {
      await this.mailService.submissionNotification(user.email, {
        formName: form.name,
        submission: payload.answersHtml,
        link: submissionLink
      })
    }

    const respondentNotificationEnabled = Object.prototype.hasOwnProperty.call(
      formSettings,
      'enableRespondentNotification'
    )
      ? formSettings.enableRespondentNotification
      : project?.enableRespondentNotification

    if (respondentNotificationEnabled && helper.isValid(payload.respondentEmail)) {
      const subject = interpolateLeadTemplate(
        formSettings.respondentNotificationSubject ||
          project?.respondentNotificationSubject ||
          'We received your submission for {formName}',
        values
      )
      const body = renderLeadTemplateHtml(
        formSettings.respondentNotificationMessage ||
          project?.respondentNotificationMessage ||
          'Hi {respondentName},\n\nThanks for your submission to {formName}. We received it on {submittedAt}. A team member will review it and follow up if needed.',
        values
      )

      await this.mailService.sendDirect(payload.respondentEmail!, {
        subject,
        html: renderNotificationLayout(
          subject,
          `${body}<div style="margin-top:20px;color:#6b7280;font-size:12px;">Reference: ${escapeHtml(
            payload.submissionId
          )}</div>`
        )
      })
    }

    const operatorEmails = getUniqueEmails(
      formSettings.operatorNotificationEmails,
      inheritedProjectRecipients
    )

    if (formSettings.enableOperatorNotification && operatorEmails.length > 0) {
      const subject = interpolateLeadTemplate(
        formSettings.operatorNotificationSubject ||
          'New lead for {formName}: {leadPriority} priority',
        values
      )
      const message = renderLeadTemplateHtml(
        formSettings.operatorNotificationMessage ||
          'A new lead was captured for {formName}.\n\nName: {respondentName}\nEmail: {respondentEmail}\nPhone: {respondentPhone}\nScore: {leadScore}\nQuality: {leadQuality}\nPriority: {leadPriority}\nSubmitted: {submittedAt}',
        values
      )

      await this.mailService.sendDirect(operatorEmails, {
        subject,
        html: renderNotificationLayout(
          subject,
          `${message}
            <div style="margin-top:24px;padding-top:20px;border-top:1px solid #eef2f7;">
              <h2 style="margin:0 0 12px;font-size:16px;color:#111827;">Submission details</h2>
              ${payload.answersHtml}
            </div>
            <div style="margin-top:20px;">
              <a href="${submissionLink}" style="display:inline-block;padding:10px 14px;background:#111827;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;">Open submission</a>
            </div>`,
          [
            helper.isValid(payload.clientName) ? `Client: ${escapeHtml(payload.clientName!)}` : undefined,
            helper.isValid(project?.name) ? `Project: ${escapeHtml(project!.name)}` : undefined,
            helper.isValid(resolvedTimezone) ? `Timezone: ${escapeHtml(resolvedTimezone!)}` : undefined
          ]
            .filter(Boolean)
            .join(' | ') || undefined
        )
      })
    }
  }
}
