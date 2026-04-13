import { InjectQueue } from '@nestjs/bull'
import { BadRequestException, Injectable } from '@nestjs/common'
import { JobOptions, Queue } from 'bull'
import { readFileSync, readdirSync } from 'fs'
import { basename, extname, join } from 'path'

import { SmtpOptionsFactory } from '@config'
import { EMAIL_TEMPLATES_DIR, SMTP_FROM } from '@environments'
import { helper } from '@heyform-inc/utils'
import { SmtpOptions, validateSmtpConfig } from '@utils'

interface JoinWorkspaceAlertOptions {
  teamName: string
  userName: string
}

interface ProjectDeletionAlertOptions {
  projectName: string
  teamName: string
  userName: string
}

interface ProjectDeletionRequestOptions {
  projectName: string
  teamName: string
  code: string
}

interface SubmissionNotificationOptions {
  formName: string
  submission: string
  link: string
}

interface DirectMailOptions {
  subject: string
  html: string
}

interface AdminRegistrationApprovalRequestOptions {
  approvalLink: string
  requestedEmail: string
  requestedName: string
  signInMethod: string
}

interface TeamDeletionAlertOptions {
  teamName: string
  userName: string
}

interface TeamDeletionRequestOptions {
  teamName: string
  code: string
}

interface TeamInvitationOptions {
  userName: string
  teamName: string
  link: string
}

interface UserSecurityAlertOptions {
  deviceModel: string
  ip: string
  loginAt: string
}

interface RegistrationApprovedOptions {
  fullName: string
  loginLink: string
}

const HTML_EXT = '.html'
const TEMPLATE_META_REGEX = /^---([\s\S]*?)---[\n\s\S]\n/

@Injectable()
export class MailService {
  private readonly emailTemplates: Record<string, { subject: string; html: string }> = {}
  private readonly smtpOptions: SmtpOptions

  constructor(@InjectQueue('MailQueue') private readonly mailQueue: Queue) {
    this.smtpOptions = SmtpOptionsFactory()
    this.init()
  }

  async accountDeletionAlert(to: string) {
    await this.addQueue('account_deletion_alert', to)
  }

  async adminRegistrationApprovalRequest(
    to: string,
    options: AdminRegistrationApprovalRequestOptions
  ) {
    await this.addQueue('admin_registration_approval_request', to, options, undefined, true)
  }

  async accountDeletionRequest(to: string, code: string) {
    await this.addQueue('account_deletion_request', to, {
      code
    }, undefined, true)
  }

  async emailVerificationRequest(to: string, code: string) {
    await this.addQueue('email_verification_request', to, {
      code
    }, undefined, true)
  }

  async formInvitation(to: string, link: string) {
    await this.addQueue('form_invitation', to, {
      link
    })
  }

  async joinWorkspaceAlert(to: string, options: JoinWorkspaceAlertOptions) {
    await this.addQueue('join_workspace_alert', to, options)
  }

  async passwordChangeAlert(to: string) {
    await this.addQueue('password_change_alert', to)
  }

  async projectDeletionAlert(to: string, options: ProjectDeletionAlertOptions) {
    await this.addQueue('project_deletion_alert', to, options)
  }

  async projectDeletionRequest(to: string, options: ProjectDeletionRequestOptions) {
    await this.addQueue('project_deletion_request', to, options, undefined, true)
  }

  async registrationApproved(to: string, options: RegistrationApprovedOptions) {
    await this.addQueue('registration_approved', to, options, undefined, true)
  }

  async scheduleAccountDeletionAlert(to: string, fullName: string) {
    await this.addQueue('schedule_account_deletion_alert', to, {
      fullName,
      email: to
    })
  }

  async submissionNotification(to: string, options: SubmissionNotificationOptions) {
    await this.addQueue('submission_notification', to, options)
  }

  async sendDirect(to: string | string[], options: DirectMailOptions, jobOptions?: JobOptions) {
    const recipients = helper.isArray(to) ? to.filter(helper.isValid).join(',') : to

    if (!helper.isValid(recipients) || !helper.isValid(options.subject) || !helper.isValid(options.html)) {
      return
    }

    await this.assertMailDeliveryConfigured()

    await this.enqueue(
      {
        queueName: 'MailQueue',
        data: {
          from: SMTP_FROM,
          to: recipients,
          subject: options.subject,
          html: options.html
        }
      },
      jobOptions
    )
  }

  async teamDataExportReady(to: string, link: string) {
    await this.addQueue('team_data_export_ready', to, {
      link
    })
  }

  async teamDeletionAlert(to: string, options: TeamDeletionAlertOptions) {
    await this.addQueue('team_deletion_alert', to, options)
  }

  async teamDeletionRequest(to: string, options: TeamDeletionRequestOptions) {
    await this.addQueue('team_deletion_request', to, options, undefined, true)
  }

  async teamInvitation(to: string, options: TeamInvitationOptions) {
    await this.addQueue('team_invitation', to, {
      ...options,
      email: to
    })
  }

  async userSecurityAlert(to: string, options: UserSecurityAlertOptions) {
    await this.addQueue('user_security_alert', to, options)
  }

  private init() {
    const allFiles = readdirSync(EMAIL_TEMPLATES_DIR)
    const filePaths = allFiles
      .filter(file => extname(file) === HTML_EXT)
      .map(file => join(EMAIL_TEMPLATES_DIR, file))

    for (const filePath of filePaths) {
      const name = basename(filePath, HTML_EXT)
      const content = readFileSync(filePath).toString('utf8')
      const matches = content.match(TEMPLATE_META_REGEX)

      const html = content.replace(TEMPLATE_META_REGEX, '')

      if (matches) {
        const metaLines = matches[1].split('\n')
        const metaObject: Record<string, string> = {}

        metaLines.forEach(line => {
          const [key, value] = line.split(':')

          if (helper.isValid(key) && helper.isValid(value)) {
            metaObject[key.trim()] = value.trim()
          }
        })

        this.emailTemplates[name] = {
          subject: metaObject.title,
          html
        }
      }
    }
  }

  private async addQueue(
    templateName: string,
    to: string,
    replacements?: Record<string, any>,
    options?: JobOptions,
    waitForCompletion = false
  ) {
    const result = this.emailTemplates[templateName]

    if (helper.isEmpty(result)) {
      throw new BadRequestException('Email delivery template is unavailable on this server.')
    }

    let subject = result!.subject
    let html = result!.html

    if (helper.isValid(replacements) && helper.isPlainObject(replacements)) {
      Object.keys(replacements!).forEach(key => {
        const value = replacements![key]
        const regex = new RegExp(`{${key}}`, 'g')

        subject = subject.replace(regex, value)
        html = html?.replace(regex, value)
      })
    }

    await this.assertMailDeliveryConfigured()

    await this.enqueue(
      {
        queueName: 'MailQueue',
        data: {
          from: SMTP_FROM,
          to,
          subject,
          html
        }
      },
      options,
      waitForCompletion
    )
  }

  private async assertMailDeliveryConfigured() {
    const configError = validateSmtpConfig(this.smtpOptions, SMTP_FROM)

    if (configError) {
      throw new BadRequestException(configError)
    }
  }

  private async enqueue(data: Record<string, any>, options?: JobOptions, waitForCompletion = false) {
    const job = await this.mailQueue.add(data, options)

    if (waitForCompletion) {
      await job.finished()
    }
  }
}
