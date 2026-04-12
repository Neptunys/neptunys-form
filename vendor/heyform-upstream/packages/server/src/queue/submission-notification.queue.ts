import { Process, Processor } from '@nestjs/bull'
import { Job } from 'bull'

import { APP_HOMEPAGE_URL } from '@environments'
import { helper } from '@heyform-inc/utils'
import { FormService, MailService, SubmissionService, TeamService, UserService } from '@service'
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

@Processor('SubmissionNotificationQueue')
export class SubmissionNotificationQueue extends BaseQueue {
  constructor(
    private readonly submissionService: SubmissionService,
    private readonly mailService: MailService,
    private readonly formService: FormService,
    private readonly userService: UserService,
    private readonly teamService: TeamService
  ) {
    super()
  }

  @Process()
  async process(job: Job<IntegrationQueueJob>): Promise<any> {
    const [submission, form] = await Promise.all([
      this.submissionService.findById(job.data.submissionId),
      this.formService.findById(job.data.formId)
    ])

    const [user, team] = await Promise.all([
      this.userService.findById(form.memberId),
      this.teamService.findById(form.teamId)
    ])

    const payload = buildLeadCapturePayload(form, submission, team || undefined)
    const submissionLink = `${APP_HOMEPAGE_URL}/workspace/${form.teamId}/project/${form.projectId}/form/${form.id}/submissions`
    const values = buildLeadTemplateValues(payload, {
      workspaceName: team?.name,
      submissionLink
    })

    if (user?.email && (form.settings as any)?.enableEmailNotification) {
      await this.mailService.submissionNotification(user.email, {
        formName: form.name,
        submission: payload.answersHtml,
        link: submissionLink
      })
    }

    if ((form.settings as any)?.enableRespondentNotification && helper.isValid(payload.respondentEmail)) {
      const subject = interpolateLeadTemplate(
        (form.settings as any)?.respondentNotificationSubject || 'We received your submission for {formName}',
        values
      )
      const body = renderLeadTemplateHtml(
        (form.settings as any)?.respondentNotificationMessage ||
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
      (form.settings as any)?.operatorNotificationEmails,
      team?.leadNotificationEmails
    )

    if ((form.settings as any)?.enableOperatorNotification && operatorEmails.length > 0) {
      const subject = interpolateLeadTemplate(
        (form.settings as any)?.operatorNotificationSubject ||
          'New lead for {formName}: {leadPriority} priority',
        values
      )
      const message = renderLeadTemplateHtml(
        (form.settings as any)?.operatorNotificationMessage ||
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
          helper.isValid(payload.clientName)
            ? `Client: ${escapeHtml(payload.clientName!)}${helper.isValid(team?.reportingTimezone) ? ` | Timezone: ${escapeHtml(team!.reportingTimezone!)}` : ''}`
            : undefined
        )
      })
    }
  }
}
