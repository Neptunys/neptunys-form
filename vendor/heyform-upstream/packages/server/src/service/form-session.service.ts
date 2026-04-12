import { InjectModel } from '@nestjs/mongoose'
import { Injectable } from '@nestjs/common'
import { Model } from 'mongoose'

import {
  FormOpenHistoryModel,
  FormSessionQuestionMetricModel,
  FormSessionStatusEnum
} from '@model'
import { helper, nanoid, timestamp } from '@heyform-inc/utils'

const SESSION_REUSE_WINDOW_SECONDS = 30 * 60

function normalizeQuestionMetrics(metrics: FormSessionQuestionMetricModel[]) {
  return metrics.map(metric => ({
    ...metric,
    totalDurationMs: Math.max(0, metric.totalDurationMs / 1000)
  }))
}

interface CreateFormSessionOptions {
  formId: string
  projectId: string
  teamId: string
  anonymousId: string
  experimentId?: string
  variantFormId?: string
  source?: Record<string, string>
}

interface CreateFormSessionResult {
  sessionId: string
  isNewSession: boolean
}

interface UpdateFormSessionOptions {
  sessionId: string
  formId: string
  metrics?: FormSessionQuestionMetricModel[]
  lastQuestionId?: string
  lastQuestionOrder?: number
  submitted?: boolean
}

@Injectable()
export class FormSessionService {
  constructor(
    @InjectModel(FormOpenHistoryModel.name)
    private readonly formOpenHistoryModel: Model<FormOpenHistoryModel>
  ) {}

  async create(options: CreateFormSessionOptions): Promise<CreateFormSessionResult> {
    const now = timestamp()

    const existingSession = helper.isValid(options.anonymousId)
      ? await this.formOpenHistoryModel
          .findOne({
            formId: options.formId,
            anonymousId: options.anonymousId,
            status: FormSessionStatusEnum.ACTIVE,
            lastSeenAt: {
              $gte: now - SESSION_REUSE_WINDOW_SECONDS
            }
          })
          .sort({ lastSeenAt: -1 })
      : null

    if (existingSession) {
      const currentSource = existingSession.source || {}
      const nextSource = {
        ...currentSource
      } as Record<string, string>

      Object.entries(options.source || {}).forEach(([key, value]) => {
        if (helper.isValid(value) && helper.isEmpty((currentSource as any)?.[key])) {
          nextSource[key] = value
        }
      })

      await this.formOpenHistoryModel.updateOne(
        { _id: existingSession.id },
        {
          $set: {
            lastSeenAt: now,
            experimentId: options.experimentId || existingSession.experimentId,
            variantFormId: options.variantFormId || existingSession.variantFormId,
            source: nextSource
          }
        }
      )

      return {
        sessionId: existingSession.id,
        isNewSession: false
      }
    }

    const sessionId = nanoid(12)

    await this.formOpenHistoryModel.create({
      _id: sessionId,
      formId: options.formId,
      projectId: options.projectId,
      teamId: options.teamId,
      anonymousId: options.anonymousId,
      experimentId: options.experimentId,
      variantFormId: options.variantFormId || options.formId,
      status: FormSessionStatusEnum.ACTIVE,
      startAt: now,
      lastSeenAt: now,
      source: options.source || {},
      questionMetrics: []
    })

    return {
      sessionId,
      isNewSession: true
    }
  }

  async update(options: UpdateFormSessionOptions): Promise<boolean> {
    const session = await this.formOpenHistoryModel.findOne({
      _id: options.sessionId,
      formId: options.formId
    })

    if (!session) {
      return false
    }

    const now = timestamp()
    const updates: Record<string, any> = {
      lastSeenAt: now
    }

    if (helper.isValid(options.lastQuestionId)) {
      updates.lastQuestionId = options.lastQuestionId
    }

    if (helper.isValid(options.lastQuestionOrder)) {
      updates.lastQuestionOrder = options.lastQuestionOrder
    }

    if (helper.isValidArray(options.metrics)) {
      updates.questionMetrics = normalizeQuestionMetrics(options.metrics)
    }

    if (options.submitted) {
      updates.status = FormSessionStatusEnum.COMPLETED
      updates.completedAt = now
      updates.totalDurationMs = Math.max(0, now - session.startAt)
    }

    const result = await this.formOpenHistoryModel.updateOne({ _id: session.id }, { $set: updates })

    return result.acknowledged
  }

  async getSummary(formId: string, startAt: number, endAt: number) {
    const [totalVisits, completed] = await Promise.all([
      this.formOpenHistoryModel.countDocuments({
        formId,
        startAt: {
          $gte: startAt,
          $lte: endAt
        }
      }),
      this.formOpenHistoryModel.aggregate([
        {
          $match: {
            formId,
            status: FormSessionStatusEnum.COMPLETED,
            startAt: {
              $gte: startAt,
              $lte: endAt
            }
          }
        },
        {
          $group: {
            _id: null,
            submissions: { $sum: 1 },
            averageTime: { $avg: '$totalDurationMs' }
          }
        }
      ])
    ])

    const submissions = completed[0]?.submissions || 0
    const averageTime = completed[0]?.averageTime || 0

    return {
      totalVisits,
      submissionCount: submissions,
      averageTime,
      completeRate: totalVisits > 0 ? (submissions / totalVisits) * 100 : 0
    }
  }

  async getQuestionAnalytics(formId: string, startAt: number, endAt: number) {
    const [totalVisits, completedSessions, rows] = await Promise.all([
      this.formOpenHistoryModel.countDocuments({
        formId,
        startAt: { $gte: startAt, $lte: endAt }
      }),
      this.formOpenHistoryModel.countDocuments({
        formId,
        status: FormSessionStatusEnum.COMPLETED,
        startAt: { $gte: startAt, $lte: endAt }
      }),
      this.formOpenHistoryModel.aggregate([
        {
          $match: {
            formId,
            startAt: {
              $gte: startAt,
              $lte: endAt
            }
          }
        },
        {
          $unwind: {
            path: '$questionMetrics',
            preserveNullAndEmptyArrays: false
          }
        },
        {
          $group: {
            _id: '$questionMetrics.questionId',
            order: { $first: '$questionMetrics.order' },
            title: { $first: '$questionMetrics.title' },
            reachCount: {
              $sum: {
                $cond: [{ $gt: ['$questionMetrics.views', 0] }, 1, 0]
              }
            },
            totalDurationMs: { $sum: '$questionMetrics.totalDurationMs' },
            completedCount: {
              $sum: {
                $cond: ['$questionMetrics.completed', 1, 0]
              }
            }
          }
        },
        {
          $sort: {
            order: 1
          }
        }
      ])
    ])

    const questions = rows.map((row: any) => ({
      questionId: row._id,
      order: row.order,
      title: row.title,
      reachCount: row.reachCount || 0,
      reachRate: totalVisits > 0 ? (row.reachCount / totalVisits) * 100 : 0,
      averageDuration: row.reachCount > 0 ? row.totalDurationMs / row.reachCount : 0,
      completedCount: row.completedCount || 0
    }))

    const durationCeiling = questions.reduce((max: number, row: any) => {
      return Math.max(max, row.averageDuration || 0)
    }, 0)

    return questions.map((row: any, index: number) => {
      const nextReach = questions[index + 1]?.reachCount ?? completedSessions
      const dropOffCount = Math.max(0, row.reachCount - nextReach)
      const dropOffRate = row.reachCount > 0 ? (dropOffCount / row.reachCount) * 100 : 0
      const durationWeight = durationCeiling > 0 ? (row.averageDuration / durationCeiling) * 100 : 0
      const frictionScore = Math.round(dropOffRate * 0.7 + durationWeight * 0.3)

      return {
        ...row,
        dropOffCount,
        dropOffRate,
        frictionScore,
        frictionLevel:
          frictionScore >= 55 ? 'high' : frictionScore >= 30 ? 'medium' : 'low'
      }
    })
  }

  async getExperimentMetrics(experimentId: string, startAt?: number, endAt?: number) {
    const match: Record<string, any> = {
      experimentId
    }

    if (helper.isValid(startAt) || helper.isValid(endAt)) {
      match.startAt = {}

      if (helper.isValid(startAt)) {
        match.startAt.$gte = startAt
      }

      if (helper.isValid(endAt)) {
        match.startAt.$lte = endAt
      }
    }

    return this.formOpenHistoryModel.aggregate([
      {
        $match: match
      },
      {
        $group: {
          _id: '$variantFormId',
          visits: { $sum: 1 },
          submissions: {
            $sum: {
              $cond: [{ $eq: ['$status', FormSessionStatusEnum.COMPLETED] }, 1, 0]
            }
          },
          averageTime: {
            $avg: {
              $cond: [
                { $eq: ['$status', FormSessionStatusEnum.COMPLETED] },
                '$totalDurationMs',
                '$$REMOVE'
              ]
            }
          }
        }
      }
    ])
  }
}