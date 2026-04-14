import {
  Answer,
  HiddenFieldAnswer,
  SubmissionCategoryEnum,
  SubmissionStatusEnum,
  Variable
} from '@heyform-inc/shared-types-enums'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { FormService } from './form.service'
import { date, helper } from '@heyform-inc/utils'
import { SubmissionModel } from '@model'
import { getUpdateQuery } from '@utils'
import { UserAgent } from '@utils'

const { isValid } = helper

interface FindSubmissionOptions {
  formId: string
  category?: SubmissionCategoryEnum
  labelId?: string
  page?: number
  limit?: number
  includePartial?: boolean
}

interface UpdateCategoryOptions {
  formId: string
  submissionIds: string[]
  category: SubmissionCategoryEnum
}

interface QuestionAnalyticsSeed {
  questionId: string
  order: number
  title?: string
}

@Injectable()
export class SubmissionService {
  constructor(
    @InjectModel(SubmissionModel.name)
    private readonly submissionModel: Model<SubmissionModel>,
    private readonly formService: FormService
  ) {}

  async findById(id: string): Promise<SubmissionModel | null> {
    return this.submissionModel.findById(id)
  }

  async findByFormId(formId: string, submissionId: string): Promise<SubmissionModel | null> {
    return this.submissionModel.findOne({
      _id: submissionId,
      formId
    })
  }

  async findPartialBySession(formId: string, sessionId: string): Promise<SubmissionModel | null> {
    return this.submissionModel.findOne({
      formId,
      sessionId,
      isPartial: true
    })
  }

  private buildConditions({
    formId,
    category,
    labelId,
    includePartial = false
  }: FindSubmissionOptions): Record<string, any> {
    const conditions: Record<string, any> = {
      formId,
      status: SubmissionStatusEnum.PUBLIC
    }

    if (!includePartial) {
      conditions.isPartial = { $ne: true }
    }

    if (helper.isValid(category)) {
      conditions.category = category
    }

    if (helper.isValid(labelId)) {
      conditions.labels = labelId
    }

    return conditions
  }

  async findAll({
    formId,
    category,
    labelId,
    page = 1,
    limit = 30,
    includePartial = false
  }: FindSubmissionOptions): Promise<SubmissionModel[]> {
    const conditions = this.buildConditions({
      formId,
      category,
      labelId,
      includePartial
    })

    return this.submissionModel
      .find(conditions)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({
        _id: -1
      })
  }

  async countAllWithFieldId(formId: string, fieldId: string): Promise<number> {
    return this.submissionModel.countDocuments({
      formId,
      'answers.id': fieldId,
      isPartial: { $ne: true },
      status: SubmissionStatusEnum.PUBLIC
    })
  }

  async findAllWithFieldId(
    formId: string,
    fieldId: string,
    page = 1,
    limit = 30
  ): Promise<SubmissionModel[]> {
    const answers = {
      $elemMatch: {
        id: fieldId as string
      }
    }
    const projections = {
      id: 1,
      answers,
      endAt: 1
    }
    const conditions: Record<string, any> = {
      formId,
      answers,
      isPartial: { $ne: true },
      status: SubmissionStatusEnum.PUBLIC
    }

    return this.submissionModel
      .find(conditions)
      .select(projections)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({
        endAt: -1
      })
  }

  async findAllGroupInFieldIds(
    formId: string,
    fieldIds: string[],
    limit = 10
  ): Promise<SubmissionModel[]> {
    if (helper.isEmpty(fieldIds)) {
      return []
    }

    return this.submissionModel.aggregate([
      {
        $unwind: '$answers'
      },
      {
        $match: {
          formId,
          'answers.id': {
            $in: fieldIds
          }
        }
      },
      { $sort: { endAt: -1 } },
      { $limit: limit * fieldIds.length },
      {
        $group: {
          _id: '$answers.id',
          answers: {
            $push: {
              submissionId: '$_id',
              kind: '$answers.kind',
              value: '$answers.value',
              endAt: '$endAt'
            }
          }
        }
      },
      {
        $project: {
          answers: { $slice: ['$answers', limit] }
        }
      }
    ])
  }

  public async count({ formId, category, labelId, includePartial = false }: FindSubmissionOptions): Promise<number> {
    const conditions = this.buildConditions({
      formId,
      category,
      labelId,
      includePartial
    })

    return this.submissionModel.countDocuments(conditions)
  }

  public async countInForm(formId: string): Promise<number> {
    return this.submissionModel.countDocuments({
      formId,
      isPartial: { $ne: true }
    })
  }

  public async countAllInTeam(teamId: string): Promise<number> {
    const forms = await this.formService.findAllInTeam(teamId)

    if (isValid(forms)) {
      return this.countAll(
        forms.map(f => f._id),
        {
          createdAt: {
            $gte: date().startOf('month').toDate()
          }
        }
      )
    }

    return 0
  }

  public countAll(formIds: string[], filters: Record<string, any> = {}): Promise<number> {
    const conditions: Record<string, any> = {
      formId: {
        $in: formIds
      },
      ...filters
    }

    if (!Object.prototype.hasOwnProperty.call(conditions, 'isPartial')) {
      conditions.isPartial = { $ne: true }
    }

    return this.submissionModel.countDocuments(conditions)
  }

  public async countInForms(formIds: string[]): Promise<any> {
    return this.submissionModel
      .aggregate<SubmissionModel>([
        {
          $match: {
            formId: {
              $in: formIds
            },
            isPartial: {
              $ne: true
            }
          }
        },
        {
          $group: {
            _id: `$formId`,
            count: {
              $sum: 1
            }
          }
        }
      ])
      .exec()
  }

  public async countInTeams(teamIds: string[]): Promise<any> {
    return this.submissionModel
      .aggregate<SubmissionModel>([
        {
          $match: {
            teamId: {
              $in: teamIds
            },
            isPartial: {
              $ne: true
            }
          }
        },
        {
          $group: {
            _id: `$formId`,
            count: {
              $sum: 1
            }
          }
        }
      ])
      .exec()
  }

  public async create(submission: SubmissionModel | any): Promise<string> {
    const result = await this.submissionModel.create(submission)
    return result.id
  }

  public async upsertPartialLeadSubmission(input: {
    formId: string
    sessionId: string
    title: string
    answers: Answer[]
    hiddenFields?: HiddenFieldAnswer[]
    variables?: Variable[]
    startAt?: number
    endAt?: number
    ip?: string
    userAgent?: UserAgent
    category?: SubmissionCategoryEnum
    status?: SubmissionStatusEnum
  }): Promise<string> {
    const result = await this.submissionModel.findOneAndUpdate(
      {
        formId: input.formId,
        sessionId: input.sessionId,
        isPartial: true
      },
      {
        $set: {
          title: input.title,
          answers: input.answers,
          hiddenFields: input.hiddenFields || [],
          variables: input.variables || [],
          endAt: input.endAt,
          ip: input.ip,
          userAgent: input.userAgent,
          category: input.category || SubmissionCategoryEnum.INBOX,
          status: input.status || SubmissionStatusEnum.PUBLIC,
          isPartial: true
        },
        $setOnInsert: {
          formId: input.formId,
          sessionId: input.sessionId,
          startAt: input.startAt
        }
      },
      {
        upsert: true,
        new: true
      }
    )

    return result.id
  }

  async updateSubmission(submissionId: string, updates: Record<string, any>): Promise<boolean> {
    const sanitizedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => !helper.isNil(value))
    )

    const result = await this.submissionModel.updateOne(
      {
        _id: submissionId
      },
      {
        $set: sanitizedUpdates
      }
    )

    return result.acknowledged
  }

  public async maskAsPrivate(formId: string, submissionIds?: string[]): Promise<boolean> {
    const conditions: any = {
      formId
    }

    if (submissionIds) {
      conditions._id = {
        $in: submissionIds
      }
    }

    const result = await this.submissionModel.updateOne(conditions, {
      status: SubmissionStatusEnum.PRIVATE
    })
    return result.matchedCount > 0
  }

  public async deleteByIds(formId: string, submissionIds?: string[]): Promise<boolean> {
    const conditions: any = {
      formId
    }

    if (submissionIds) {
      conditions._id = {
        $in: submissionIds
      }
    }

    const result = await this.submissionModel.deleteMany(conditions)
    return (result.deletedCount ?? 0) > 0
  }

  public async deleteAll(formId: string | string[]): Promise<boolean> {
    const conditions: Record<string, any> = {
      formId
    }

    if (helper.isValidArray(formId)) {
      conditions.formId = {
        $in: formId as string[]
      }
    }

    const result = await this.submissionModel.deleteMany(conditions)
    return (result.deletedCount ?? 0) > 0
  }

  public async updateCategory({
    formId,
    submissionIds,
    category
  }: UpdateCategoryOptions): Promise<boolean> {
    const result = await this.submissionModel.updateMany(
      {
        formId,
        _id: {
          $in: submissionIds
        }
      },
      {
        category
      }
    )
    return result.matchedCount > 0
  }

  async findByIds(formId: string, submissionIds: string[]): Promise<SubmissionModel[]> {
    const conditions: Record<string, any> = {
      formId,
      _id: {
        $in: submissionIds
      },
      status: SubmissionStatusEnum.PUBLIC
    }
    return this.submissionModel.find(conditions)
  }

  async findAllByForm(formId: string): Promise<SubmissionModel[]> {
    let submissions = []
    const limit = 1000
    const submissionCount = await this.count({
      formId
    })

    if (submissionCount < limit) {
      submissions = await this.findAll({
        formId,
        page: 1,
        limit
      })
    } else {
      const promises = []
      const max = Math.ceil(submissionCount / limit)

      for (let i = 1; i <= max; i++) {
        promises.push(
          this.findAll({
            formId,
            page: i,
            limit
          })
        )
      }

      const result = await Promise.all(promises)
      submissions = result.reduce((prev, next) => [...prev, ...next], [])
    }

    return submissions
  }

  async findAllInFormsByDateRange(
    formIds: string[],
    startAt: number,
    endAt: number
  ): Promise<SubmissionModel[]> {
    if (!helper.isValidArray(formIds)) {
      return []
    }

    return this.submissionModel
      .find({
        formId: {
          $in: formIds
        },
        isPartial: {
          $ne: true
        },
        endAt: {
          $gte: startAt,
          $lte: endAt
        },
        status: {
          $ne: SubmissionStatusEnum.DELETED
        }
      })
      .sort({
        endAt: -1
      })
  }

  async createAnswer(submissionId: string, answer: Answer): Promise<boolean> {
    const result = await this.submissionModel.updateOne(
      {
        _id: submissionId
      },
      {
        $push: {
          answers: answer
        }
      }
    )
    return result.acknowledged
  }

  async updateAnswer(submissionId: string, answer: Answer): Promise<boolean> {
    const updates = {
      kind: answer.kind,
      properties: answer.properties,
      value: answer.value
    }

    const result = await this.submissionModel.updateOne(
      {
        _id: submissionId,
        'answers.id': answer.id
      },
      {
        $set: getUpdateQuery(updates, 'answers.$', false)
      }
    )
    return result.acknowledged
  }

  async analytic(formId: string, startAt: number, endAt: number) {
    return this.submissionModel.aggregate([
      {
        $match: {
          formId: formId,
          isPartial: { $ne: true },
          startAt: { $gte: startAt },
          endAt: { $lte: endAt }
        }
      },
      {
        $group: {
          _id: null,
          avgAverageTime: {
            $avg: { $subtract: ['$endAt', '$startAt'] }
          },
          avgSubmissionCount: { $sum: 1 }
        }
      }
    ])
  }

  async questionAnalytics(
    formId: string,
    questions: QuestionAnalyticsSeed[],
    startAt: number,
    endAt: number
  ) {
    if (!helper.isValidArray(questions)) {
      return []
    }

    const orderedQuestions = [...questions].sort((left, right) => left.order - right.order)
    const questionIds = orderedQuestions.map(question => question.questionId)

    const [result] = await this.submissionModel.aggregate([
      {
        $match: {
          formId,
          status: SubmissionStatusEnum.PUBLIC,
          isPartial: { $ne: true },
          startAt: { $gte: startAt },
          endAt: { $lte: endAt }
        }
      },
      {
        $facet: {
          totals: [{ $count: 'submissionCount' }],
          answers: [
            {
              $unwind: '$answers'
            },
            {
              $match: {
                'answers.id': {
                  $in: questionIds
                }
              }
            },
            {
              $group: {
                _id: '$answers.id',
                reachCount: { $sum: 1 }
              }
            }
          ]
        }
      }
    ])

    const submissionCount = result?.totals?.[0]?.submissionCount || 0
    const answerCounts = new Map<string, number>()

    ;(result?.answers || []).forEach((row: { _id: string; reachCount: number }) => {
      answerCounts.set(row._id, row.reachCount || 0)
    })

    return orderedQuestions
      .map((question, index) => {
        const reachCount = answerCounts.get(question.questionId) || 0
        const nextReach = index < orderedQuestions.length - 1
          ? answerCounts.get(orderedQuestions[index + 1].questionId) || 0
          : submissionCount
        const completedCount = Math.min(reachCount, nextReach)
        const dropOffCount = Math.max(0, reachCount - nextReach)
        const dropOffRate = reachCount > 0 ? (dropOffCount / reachCount) * 100 : 0
        const frictionScore = Math.round(dropOffRate)

        return {
          questionId: question.questionId,
          order: question.order,
          title: question.title,
          reachCount,
          reachRate: submissionCount > 0 ? (reachCount / submissionCount) * 100 : 0,
          averageDuration: 0,
          completedCount,
          dropOffCount,
          dropOffRate,
          frictionScore,
          frictionLevel:
            frictionScore >= 55 ? 'high' : frictionScore >= 30 ? 'medium' : 'low'
        }
      })
      .filter(question => question.reachCount > 0)
  }
}
