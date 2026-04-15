import { Process, Processor } from '@nestjs/bull'
import { Job } from 'bull'

import { AppService, FormService, IntegrationService, ProjectService, SubmissionService, TeamService } from '@service'
import { mapToObject } from '@utils'

import { BaseQueue } from './base.queue'

export interface IntegrationQueueJob {
  appId: string
  integrationId?: string
  formId: string
  submissionId: string
  teamId?: string
  projectId?: string
  config?: Record<string, any>
  deliveryTarget?: 'integration' | 'project-google-sheets' | 'workspace-google-sheets'
}

@Processor('IntegrationQueue')
export class IntegrationQueue extends BaseQueue {
  constructor(
    private readonly appService: AppService,
    private readonly integrationService: IntegrationService,
    private readonly submissionService: SubmissionService,
    private readonly formService: FormService,
    private readonly projectService: ProjectService,
    private readonly teamService: TeamService
  ) {
    super()
  }

  @Process()
  async process(job: Job<IntegrationQueueJob>) {
    const { appId, config: rawConfig, deliveryTarget, formId, integrationId, projectId, submissionId, teamId } = job.data
    const app = this.appService.findById(appId)

    if (app) {
      const [integration, submission, form] = await Promise.all([
        integrationId ? this.integrationService.findById(integrationId) : Promise.resolve(null),
        this.submissionService.findById(submissionId),
        this.formService.findById(formId)
      ])

      if (submission && form) {
        const [team, project] = await Promise.all([
          this.teamService.findById(teamId || form.teamId),
          form.projectId ? this.projectService.findById(projectId || form.projectId) : Promise.resolve(null)
        ])
        const config = integration ? mapToObject(integration.config) : mapToObject(rawConfig)

        try {
          await app.run({
            submission,
            form,
            config,
            team: team || undefined,
            project: project || undefined
          })

          if (integration) {
            await this.integrationService.update(integration.id, {
              lastDeliveryAt: Math.floor(Date.now() / 1000),
              lastDeliveryStatus: 'success',
              lastDeliveryMessage: ''
            })
          }

          if (deliveryTarget === 'workspace-google-sheets' && teamId) {
            await this.teamService.update(teamId, {
              googleSheetsLeadLastDeliveryAt: Math.floor(Date.now() / 1000),
              googleSheetsLeadLastDeliveryStatus: 'success',
              googleSheetsLeadLastDeliveryMessage: ''
            })
          }

          if (deliveryTarget === 'project-google-sheets' && projectId) {
            await this.projectService.update(projectId, {
              $set: {
                googleSheetsLeadLastDeliveryAt: Math.floor(Date.now() / 1000),
                googleSheetsLeadLastDeliveryStatus: 'success',
                googleSheetsLeadLastDeliveryMessage: ''
              }
            })
          }
        } catch (error: any) {
          if (integration) {
            await this.integrationService.update(integration.id, {
              lastDeliveryAt: Math.floor(Date.now() / 1000),
              lastDeliveryStatus: 'error',
              lastDeliveryMessage: error?.message || 'Integration delivery failed'
            })
          }

          if (deliveryTarget === 'workspace-google-sheets' && teamId) {
            await this.teamService.update(teamId, {
              googleSheetsLeadLastDeliveryAt: Math.floor(Date.now() / 1000),
              googleSheetsLeadLastDeliveryStatus: 'error',
              googleSheetsLeadLastDeliveryMessage:
                error?.message || 'Workspace Google Sheets delivery failed'
            })
          }

          if (deliveryTarget === 'project-google-sheets' && projectId) {
            await this.projectService.update(projectId, {
              $set: {
                googleSheetsLeadLastDeliveryAt: Math.floor(Date.now() / 1000),
                googleSheetsLeadLastDeliveryStatus: 'error',
                googleSheetsLeadLastDeliveryMessage:
                  error?.message || 'Project Google Sheets delivery failed'
              }
            })
          }

          throw error
        }
      }
    }
  }
}
