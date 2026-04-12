import { InjectQueue } from '@nestjs/bull'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Queue } from 'bull'
import { Model } from 'mongoose'
import * as apps from 'src/apps'

import { helper } from '@heyform-inc/utils'
import { FormModel, IntegrationModel, IntegrationStatusEnum } from '@model'

import { TeamService } from './team.service'

@Injectable()
export class IntegrationService {
  constructor(
    @InjectModel(IntegrationModel.name)
    private readonly integrationModel: Model<IntegrationModel>,
    @InjectQueue('IntegrationQueue') private readonly integrationQueue: Queue,
    @InjectQueue('SubmissionNotificationQueue') private readonly submissionNotificationQueue: Queue,
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

  async create(integration: IntegrationModel | any): Promise<string | undefined> {
    const result = await this.integrationModel.create(integration as any)
    return result.id
  }

  async update(id: string, updates: Record<string, any>): Promise<any> {
    const result = await this.integrationModel.updateOne(
      {
        _id: id
      },
      updates
    )
    return result.acknowledged
  }

  async updateAllBy(conditions: Record<string, any>, updates: Record<string, any>): Promise<any> {
    const result = await this.integrationModel.updateMany(conditions, updates)
    return result.matchedCount > 0
  }

  async createOrUpdate(
    formId: string,
    appId: string,
    updates: Partial<IntegrationModel>
  ): Promise<string> {
    const integration = await this.findOne(formId, appId)

    if (integration) {
      await this.update(integration.id, updates)
      return integration.id
    }

    return this.create({
      formId,
      appId,
      ...updates
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
      this.submissionNotificationQueue.add({
        formId: form.id,
        submissionId
      })
    }

    const [integrations, team] = await Promise.all([
      this.integrationModel.find({
        formId: form.id,
        status: IntegrationStatusEnum.ACTIVE
      }),
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
