import { InjectModel } from '@nestjs/mongoose'
import { BadRequestException, Injectable } from '@nestjs/common'
import { Model } from 'mongoose'
import { createHash } from 'crypto'

import {
  ExperimentModel,
  ExperimentPrimaryMetricEnum,
  ExperimentStatusEnum,
  ProjectModel
} from '@model'
import { helper, timestamp } from '@heyform-inc/utils'

import { FormSessionService } from './form-session.service'

interface ExperimentVariantInput {
  formId: string
  weight?: number
}

@Injectable()
export class ExperimentService {
  constructor(
    @InjectModel(ExperimentModel.name)
    private readonly experimentModel: Model<ExperimentModel>,
    private readonly formSessionService: FormSessionService
  ) {}

  async findById(experimentId: string): Promise<ExperimentModel | null> {
    return this.experimentModel.findById(experimentId)
  }

  async resolvePublicExperiment(
    experimentId: string,
    anonymousId?: string,
    previewVariantFormId?: string
  ) {
    const experiment = await this.findById(experimentId)

    if (!experiment) {
      throw new BadRequestException('The experiment does not exist')
    }

    const isExpired = experiment.endAt <= timestamp()
    let winnerFormId = experiment.winnerFormId

    if (experiment.status === ExperimentStatusEnum.RUNNING && isExpired) {
      const result = await this.evaluateWinner(experiment)
      winnerFormId = result.winnerFormId
    }

    const previewVariant = helper.isValid(previewVariantFormId)
      ? experiment.variants?.find(variant => variant.formId === previewVariantFormId)
      : undefined
    const formId =
      previewVariant?.formId ||
      (helper.isValid(winnerFormId)
        ? winnerFormId!
        : await this.assignVariant(experiment, anonymousId || 'anonymous'))

    return {
      experimentId: experiment.id,
      formId,
      winnerFormId
    }
  }

  async findAllInProject(projectId: string): Promise<ExperimentModel[]> {
    return this.experimentModel.find({ projectId }).sort({ createdAt: -1 })
  }

  async create(
    project: ProjectModel,
    input: {
      name: string
      variants: ExperimentVariantInput[]
      autoPromote?: boolean
      durationHours?: number
      minimumSampleSize?: number
    }
  ): Promise<string> {
    const now = timestamp()
    const durationHours = input.durationHours || 48
    const result = await this.experimentModel.create({
      teamId: project.teamId,
      projectId: project.id,
      name: input.name,
      status: ExperimentStatusEnum.RUNNING,
      primaryMetric: ExperimentPrimaryMetricEnum.CONVERSION_RATE,
      variants: this.normalizeVariants(input.variants),
      autoPromote: helper.isNil(input.autoPromote) ? true : !!input.autoPromote,
      durationHours,
      minimumSampleSize: input.minimumSampleSize || 0,
      startAt: now,
      endAt: now + durationHours * 60 * 60 * 1000
    })

    return result.id
  }

  async update(experimentId: string, updates: Record<string, any>): Promise<boolean> {
    const nextUpdates = { ...updates }

    if (helper.isValidArray(updates.variants)) {
      nextUpdates.variants = this.normalizeVariants(updates.variants)
    }

    if (helper.isValid(updates.durationHours)) {
      const experiment = await this.findById(experimentId)

      if (experiment) {
        nextUpdates.endAt = experiment.startAt + Number(updates.durationHours) * 60 * 60 * 1000
      }
    }

    const result = await this.experimentModel.updateOne({ _id: experimentId }, { $set: nextUpdates })

    return result.acknowledged
  }

  async delete(experimentId: string): Promise<boolean> {
    const result = await this.experimentModel.deleteOne({ _id: experimentId })
    return (result.deletedCount ?? 0) > 0
  }

  async assignVariant(experiment: ExperimentModel, anonymousId: string): Promise<string> {
    if (helper.isValid(experiment.winnerFormId)) {
      return experiment.winnerFormId!
    }

    const variants = experiment.variants || []

    if (!helper.isValidArray(variants)) {
      throw new Error('Experiment variants are required')
    }

    const seed = createHash('sha1')
      .update(`${experiment.id}:${anonymousId}`)
      .digest('hex')
      .slice(0, 8)
    const bucket = (parseInt(seed, 16) % 100) + 1

    let cursor = 0

    for (const variant of variants) {
      cursor += variant.weight

      if (bucket <= cursor) {
        return variant.formId
      }
    }

    return variants[variants.length - 1].formId
  }

  async getMetrics(experiment: ExperimentModel) {
    const rows = await this.formSessionService.getExperimentMetrics(
      experiment.id,
      experiment.startAt,
      experiment.endAt
    )
    const rowMap = new Map(rows.map((row: any) => [row._id, row]))
    const minimumSampleSize = Number(experiment.minimumSampleSize) || 0

    return experiment.variants.map(variant => {
      const row = rowMap.get(variant.formId)
      const visits = row?.visits || 0
      const submissions = row?.submissions || 0
      const meetsMinimumSample = minimumSampleSize < 1 || visits >= minimumSampleSize

      return {
        formId: variant.formId,
        weight: variant.weight,
        visits,
        submissions,
        conversionRate: visits > 0 ? (submissions / visits) * 100 : 0,
        averageTime: row?.averageTime || 0,
        meetsMinimumSample,
        minimumSampleGap: meetsMinimumSample ? 0 : minimumSampleSize - visits
      }
    })
  }

  async evaluateWinner(experiment: ExperimentModel) {
    const metrics = await this.getMetrics(experiment)
    const minimumSampleSize = Number(experiment.minimumSampleSize) || 0
    const minimumSampleReached =
      minimumSampleSize < 1 || metrics.every(metric => metric.visits >= minimumSampleSize)
    const eligibleMetrics = minimumSampleReached ? metrics.filter(metric => metric.visits > 0) : []
    const ranked = [...eligibleMetrics].sort((left, right) => {
      if (right.conversionRate !== left.conversionRate) {
        return right.conversionRate - left.conversionRate
      }

      if (right.submissions !== left.submissions) {
        return right.submissions - left.submissions
      }

      return left.averageTime - right.averageTime
    })
    const winner = ranked[0]

    return {
      winnerFormId: winner?.formId,
      minimumSampleReached,
      promotionBlockedReason: minimumSampleReached
        ? undefined
        : `Needs at least ${minimumSampleSize} visits on every variant before a winner can be promoted.`,
      metrics: metrics.map(metric => ({
        ...metric,
        isWinner: metric.formId === winner?.formId
      }))
    }
  }

  async finalizeDueExperiments(now = timestamp()): Promise<void> {
    const experiments = await this.experimentModel.find({
      status: ExperimentStatusEnum.RUNNING,
      endAt: {
        $lte: now
      }
    })

    for (const experiment of experiments) {
      const { winnerFormId } = await this.evaluateWinner(experiment)
      const nextStatus = experiment.autoPromote && winnerFormId
        ? ExperimentStatusEnum.PROMOTED
        : ExperimentStatusEnum.COMPLETED

      await this.update(experiment.id, {
        status: nextStatus,
        winnerFormId,
        promotedAt: nextStatus === ExperimentStatusEnum.PROMOTED ? now : undefined
      })
    }
  }

  private normalizeVariants(variants: ExperimentVariantInput[]) {
    const unique = variants.filter(
      (variant, index, list) =>
        helper.isValid(variant?.formId) && list.findIndex(row => row.formId === variant.formId) === index
    )

    if (!helper.isValidArray(unique)) {
      return []
    }

    const providedTotal = unique.reduce((sum, row) => sum + (Number(row.weight) || 0), 0)

    if (providedTotal > 0) {
      const normalized = unique.map(row => ({
        formId: row.formId,
        weight: Math.max(1, Math.round(((Number(row.weight) || 0) / providedTotal) * 100))
      }))
      const normalizedTotal = normalized.reduce((sum, row) => sum + row.weight, 0)

      if (normalizedTotal !== 100) {
        normalized[normalized.length - 1].weight += 100 - normalizedTotal
      }

      return normalized
    }

    const evenWeight = Math.floor(100 / unique.length)
    const remainder = 100 - evenWeight * unique.length

    return unique.map((row, index) => ({
      formId: row.formId,
      weight: evenWeight + (index < remainder ? 1 : 0)
    }))
  }
}