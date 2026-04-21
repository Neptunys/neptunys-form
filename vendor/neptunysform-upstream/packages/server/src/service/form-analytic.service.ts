import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { FormSessionService } from './form-session.service'
import { SubmissionService } from './submission.service'
import { date, helper } from '@neptunysform-inc/utils'
import { FormAnalyticModel } from '@model'

function toUnixSeconds(value: Date) {
  return Math.floor(value.getTime() / 1000)
}

interface FormAnalyticOptions {
  formId: string
  startAt: Date
  endAt: Date
  isNext?: boolean
  sourceChannel?: string
  dedupeByIp?: boolean
  analyticsResetAt?: number
}

interface FormAnalyticResult {
  avgTotalVisits: number
  avgSubmissionCount: number
  avgAverageTime: number
  sourceBreakdown: Array<{
    channel: string
    totalVisits: number
    submissionCount: number
  }>
}

interface QuestionAnalyticsSeed {
  questionId: string
  order: number
  title?: string
}

function resolveAnalyticsWindow(startAt: Date, endAt: Date, analyticsResetAt?: number) {
  if (!helper.isNumber(analyticsResetAt) || analyticsResetAt! < 1) {
    return {
      startAt,
      endAt
    }
  }

  const resetAtDate = new Date(analyticsResetAt! * 1000)

  if (resetAtDate.getTime() > endAt.getTime()) {
    return null
  }

  return {
    startAt: resetAtDate.getTime() > startAt.getTime() ? resetAtDate : startAt,
    endAt
  }
}

@Injectable()
export class FormAnalyticService {
  constructor(
    @InjectModel(FormAnalyticModel.name)
    private readonly formAnalyticModel: Model<FormAnalyticModel>,
    private readonly formSessionService: FormSessionService,
    private readonly submissionService: SubmissionService
  ) {}

  public async summary({
    formId,
    startAt,
    endAt,
    isNext,
    sourceChannel,
    dedupeByIp,
    analyticsResetAt
  }: FormAnalyticOptions) {
    const window = resolveAnalyticsWindow(startAt, endAt, analyticsResetAt)
    const emptyResult = {
      avgTotalVisits: 0,
      avgSubmissionCount: 0,
      avgAverageTime: 0,
      sourceBreakdown: []
    }

    if (!window) {
      return isNext ? emptyResult : ({} as FormAnalyticResult)
    }

    const hasSessionFilters = helper.isValid(sourceChannel) || dedupeByIp

    const [sessionSummary, result, avgTotalVisits] = await Promise.all([
      this.formSessionService.getSummary(formId, toUnixSeconds(window.startAt), toUnixSeconds(window.endAt), {
        sourceChannel,
        dedupeByIp
      }),
      hasSessionFilters
        ? Promise.resolve([])
        : this.submissionService.analytic(
            formId,
            Math.floor(window.startAt.getTime() / 1000),
            Math.floor(window.endAt.getTime() / 1000)
          ),
      hasSessionFilters ? Promise.resolve(0) : this.getAverageTotalVisits(formId, window.startAt, window.endAt)
    ])

    const submissionSummary = result[0] || {}
    const submissionCount = submissionSummary.avgSubmissionCount || 0
    const averageTime = submissionSummary.avgAverageTime || 0

    if (sessionSummary.totalVisits > 0) {
      return {
        avgTotalVisits: sessionSummary.totalVisits,
        avgSubmissionCount: Math.max(sessionSummary.submissionCount, submissionCount),
        avgAverageTime: sessionSummary.averageTime || averageTime,
        sourceBreakdown: sessionSummary.sourceBreakdown || []
      }
    }

    if (hasSessionFilters) {
      return {
        avgTotalVisits: 0,
        avgSubmissionCount: 0,
        avgAverageTime: 0,
        sourceBreakdown: []
      }
    }

    const inferredTotalVisits = Math.max(avgTotalVisits, submissionCount)

    const analytic = {
      avgTotalVisits: inferredTotalVisits,
      avgSubmissionCount: submissionCount,
      avgAverageTime: averageTime,
      sourceBreakdown: []
    }

    if (inferredTotalVisits > 0 || submissionCount > 0) {
      return analytic
    } else if (isNext) {
      return analytic
    } else {
      return {} as FormAnalyticResult
    }
  }

  public async questionAnalytics(
    formId: string,
    startAt: Date,
    endAt: Date,
    questions: QuestionAnalyticsSeed[] = [],
    options: Pick<FormAnalyticOptions, 'sourceChannel' | 'dedupeByIp' | 'analyticsResetAt'> = {}
  ) {
    const window = resolveAnalyticsWindow(startAt, endAt, options.analyticsResetAt)

    if (!window) {
      return []
    }

    const sessionAnalytics = await this.formSessionService.getQuestionAnalytics(
      formId,
      toUnixSeconds(window.startAt),
      toUnixSeconds(window.endAt),
      options
    )

    if (helper.isValidArray(sessionAnalytics) || helper.isEmpty(questions)) {
      return sessionAnalytics
    }

    const fallbackAnalytics = await this.formSessionService.getQuestionAnalyticsFallback(
      formId,
      toUnixSeconds(window.startAt),
      toUnixSeconds(window.endAt),
      questions,
      options
    )

    if (helper.isValidArray(fallbackAnalytics)) {
      return fallbackAnalytics
    }

    return this.submissionService.questionAnalytics(
      formId,
      questions,
      toUnixSeconds(window.startAt),
      toUnixSeconds(window.endAt)
    )
  }

  public async getAverageTotalVisits(formId: string, startAt: Date, endAt: Date): Promise<number> {
    const result = await this.formAnalyticModel.aggregate([
      {
        $match: {
          formId,
          createdAt: {
            $gte: startAt,
            $lte: endAt
          }
        }
      },
      {
        $group: {
          _id: null,
          avgTotalVisits: { $avg: '$totalVisits' }
        }
      }
    ])

    return result[0]?.avgTotalVisits || 0
  }

  public async updateTotalVisits(formId: string): Promise<void> {
    const formAnalytic = await this.findFormAnalyticInToday(formId)

    if (formAnalytic) {
      await this.formAnalyticModel.updateOne(
        {
          _id: formAnalytic.id
        },
        {
          $inc: {
            totalVisits: 1
          }
        }
      )
    } else {
      await this.formAnalyticModel.create({
        formId,
        totalVisits: 1
      } as any)
    }
  }

  private async findFormAnalyticInToday(formId: string): Promise<FormAnalyticModel> {
    const today = date()

    return this.formAnalyticModel.findOne({
      formId,
      createdAt: {
        $gte: today.startOf('day'),
        $lte: today.endOf('day')
      }
    })
  }

  public async delete(formId: string | string[]): Promise<boolean> {
    let result: any

    if (helper.isValidArray(formId)) {
      result = await this.formAnalyticModel.deleteMany({
        formId: {
          $in: formId as string[]
        }
      })
    } else {
      result = await this.formAnalyticModel.deleteOne({
        formId: formId as string
      })
    }

    return (result.deletedCount ?? 0) > 0
  }

  public async reset(formId: string): Promise<boolean> {
    await this.formAnalyticModel.deleteMany({ formId })

    return true
  }
}
