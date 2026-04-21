import { InjectQueue } from '@nestjs/bull'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Queue } from 'bull'
import { Model } from 'mongoose'
import * as apps from 'src/apps'

import { helper } from '@neptunysform-inc/utils'
import {
  FormModel,
  IntegrationModel,
  IntegrationStatusEnum,
  normalizeIntegrationStatus
} from '@model'

import { ProjectService } from './project.service'
import { TeamService } from './team.service'

@Injectable()
export class IntegrationService {
  constructor(
    @InjectModel(IntegrationModel.name)
    private readonly integrationModel: Model<IntegrationModel>,
    @InjectQueue('IntegrationQueue') private readonly integrationQueue: Queue,
    @InjectQueue('SubmissionNotificationQueue') private readonly submissionNotificationQueue: Queue,
    private readonly projectService: ProjectService,
    private readonly teamService: TeamService
  ) {}

  async findById(id: string): Promise<IntegrationModel | null> {
    return this.integrationModel.findById(id)
  }

  async findAllInForm(formId: string): Promise<IntegrationModel[]> {
    return this.integrationModel.find({ formId })
  }

  async findAllInFormByApps(formId: string, appIds: string[]): Promise<IntegrationModel[]> {
    return this.integrationModel.find({
      formId,
      appId: {
        $in: appIds
      }
    })
  }

  async findOne(formId: string, appId: string): Promise<IntegrationModel | null> {
    return this.integrationModel.findOne({
      formId,
      appId
    })
  }

  private normalizeStatus(status: unknown): IntegrationStatusEnum | undefined {
    return normalizeIntegrationStatus(status)
  }

  private normalizeUpdates(updates?: Record<string, any>): Record<string, any> {
    if (!updates) {
      return {}
    }

    const normalizedUpdates = { ...updates }

    if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'status')) {
      const normalizedStatus = this.normalizeStatus(normalizedUpdates.status)

      if (normalizedStatus !== undefined) {
        normalizedUpdates.status = normalizedStatus
      }
    }

    return normalizedUpdates
  }

  async create(integration: IntegrationModel | any): Promise<string | undefined> {
    const result = await this.integrationModel.create(this.normalizeUpdates(integration as any) as any)
    return result.id
  }

  async update(id: string, updates: Record<string, any>): Promise<any> {
    const normalizedUpdates = this.normalizeUpdates(updates)

    const result = await this.integrationModel.updateOne(
      {
        _id: id
      },
      normalizedUpdates
    )
    return result.acknowledged
  }

  async updateAllBy(conditions: Record<string, any>, updates: Record<string, any>): Promise<any> {
    const normalizedUpdates = this.normalizeUpdates(updates)
    const result = await this.integrationModel.updateMany(conditions, normalizedUpdates)
    return result.matchedCount > 0
  }

  async createOrUpdate(
    formId: string,
    appId: string,
    updates: Partial<IntegrationModel>
  ): Promise<string> {
    const normalizedUpdates = this.normalizeUpdates(updates as Record<string, any>)
    const integration = await this.findOne(formId, appId)

    if (integration) {
      await this.update(integration.id, normalizedUpdates)
      return integration.id
    }

    return this.create({
      formId,
      appId,
      ...normalizedUpdates
    })
  }

  public async delete(formId: string, appId: string): Promise<boolean> {
    const result = await this.integrationModel.deleteOne({
      formId,
      appId
    })
    return (result.deletedCount ?? 0) > 0
  }

  public async addQueue(form: FormModel, submissionId: string): Promise<void> {
    // Email notification Queue
    if (
      (form.settings as any)?.enableEmailNotification ||
      (form.settings as any)?.enableRespondentNotification ||
      (form.settings as any)?.enableOperatorNotification
    ) {
      await this.submissionNotificationQueue.add({
        formId: form.id,
        submissionId
      })
    }

    const [integrations, project, team] = await Promise.all([
      this.integrationModel.find({
        formId: form.id,
        status: IntegrationStatusEnum.ACTIVE
      }),
      form.projectId ? this.projectService.findById(form.projectId) : Promise.resolve(null),
      this.teamService.findById(form.teamId)
    ])

    for (const integration of integrations) {
      const app = apps[integration.appId]

      if (app && typeof app.run === 'function') {
        this.integrationQueue.add({
          appId: integration.appId,
          formId: form.id,
          integrationId: integration.id,
          submissionId
        })
      }
    }

    if (
      project?.enableGoogleSheetsLeadSync &&
      helper.isObject(project.googleSheetsLeadConfig) &&
      !helper.isEmpty(project.googleSheetsLeadConfig)
    ) {
      const app = apps.googlesheets

      if (app && typeof app.run === 'function') {
        this.integrationQueue.add({
          appId: app.id,
          formId: form.id,
          submissionId,
          projectId: project.id,
          config: project.googleSheetsLeadConfig,
          deliveryTarget: 'project-google-sheets'
        })
      }
    }

    if (
      team?.enableGoogleSheetsLeadSync &&
      helper.isObject(team.googleSheetsLeadConfig) &&
      !helper.isEmpty(team.googleSheetsLeadConfig)
    ) {
      const app = apps.googlesheets

      if (app && typeof app.run === 'function') {
        this.integrationQueue.add({
          appId: app.id,
          formId: form.id,
          submissionId,
          teamId: team.id,
          config: team.googleSheetsLeadConfig,
          deliveryTarget: 'workspace-google-sheets'
        })
      }
    }
  }
}
