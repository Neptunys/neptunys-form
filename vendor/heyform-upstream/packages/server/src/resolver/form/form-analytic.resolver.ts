import { Auth, Form, FormGuard } from '@decorator'
import {
  FormAnalyticInput,
  FormAnalyticResult,
  FormAnalyticType,
  FormQuestionAnalyticType
} from '@graphql'
import { flattenFields, htmlUtils } from '@heyform-inc/answer-utils'
import { QUESTION_FIELD_KINDS } from '@heyform-inc/shared-types-enums'
import { date, helper } from '@heyform-inc/utils'
import { FormAnalyticRangeEnum } from '@model'
import { Args, Query, Resolver } from '@nestjs/graphql'
import { FormModel } from '@model'
import { FormAnalyticService } from '@service'

function getChanges(prev: number, next: number, isInteger = true) {
  const result: FormAnalyticResult = {
    value: isInteger ? Math.ceil(next) : next
  }

  if (helper.isValid(prev)) {
    const p = prev || 1
    result.change = Math.round(((next - p) * 100) / p)
  }

  return result
}

function getRate(totalVisits: number, submissionCount: number) {
  if (helper.isNil(totalVisits) || helper.isNil(submissionCount)) {
    return
  }

  if (totalVisits > 0 && submissionCount > 0) {
    return Math.min(100, 100 * (submissionCount / totalVisits))
  } else if (totalVisits < 1 && submissionCount > 1) {
    return 100
  } else {
    return 0
  }
}

function getRangeDates(input: FormAnalyticInput) {
  const now = date()
  let startAt = now.startOf('day')
  let endAt = now.endOf('day')
  let prevStartAt = now.subtract(1, 'day').startOf('day')
  let prevEndAt = now.subtract(1, 'day').endOf('day')

  switch (input.range) {
    case FormAnalyticRangeEnum.TODAY:
      break

    case FormAnalyticRangeEnum.WEEK:
      startAt = now.subtract(7, 'days').startOf('day')
      endAt = now.endOf('day')
      prevStartAt = startAt.subtract(7, 'days').startOf('day')
      prevEndAt = startAt.subtract(1, 'day').endOf('day')
      break

    case FormAnalyticRangeEnum.MONTH:
      startAt = now.subtract(1, 'months').startOf('day')
      endAt = now.endOf('day')
      prevStartAt = startAt.subtract(1, 'months').startOf('day')
      prevEndAt = startAt.subtract(1, 'day').endOf('day')
      break

    case FormAnalyticRangeEnum.THREE_MONTH:
      startAt = now.subtract(3, 'months').startOf('day')
      endAt = now.endOf('day')
      prevStartAt = startAt.subtract(3, 'months').startOf('day')
      prevEndAt = startAt.subtract(1, 'day').endOf('day')
      break

    case FormAnalyticRangeEnum.SIX_MONTH:
      startAt = now.subtract(6, 'months').startOf('day')
      endAt = now.endOf('day')
      prevStartAt = startAt.subtract(6, 'months').startOf('day')
      prevEndAt = startAt.subtract(1, 'day').endOf('day')
      break

    case FormAnalyticRangeEnum.YEAR:
      startAt = now.subtract(1, 'years').startOf('day')
      endAt = now.endOf('day')
      prevStartAt = startAt.subtract(1, 'years').startOf('day')
      prevEndAt = startAt.subtract(1, 'day').endOf('day')
      break

    case FormAnalyticRangeEnum.CUSTOM: {
      const rawStart = input.startDate ? date(input.startDate) : now
      const rawEnd = input.endDate ? date(input.endDate) : rawStart
      const normalizedStart = rawEnd.isBefore(rawStart)
        ? rawEnd.startOf('day')
        : rawStart.startOf('day')
      const normalizedEnd = rawEnd.isBefore(rawStart)
        ? rawStart.endOf('day')
        : rawEnd.endOf('day')
      const rangeDays = Math.max(
        1,
        normalizedEnd.startOf('day').diff(normalizedStart.startOf('day'), 'day') + 1
      )

      startAt = normalizedStart
      endAt = normalizedEnd
      prevStartAt = normalizedStart.subtract(rangeDays, 'day').startOf('day')
      prevEndAt = normalizedStart.subtract(1, 'day').endOf('day')
      break
    }
  }

  return {
    startAt: startAt.toDate(),
    endAt: endAt.toDate(),
    prevStartAt: prevStartAt.toDate(),
    prevEndAt: prevEndAt.toDate()
  }
}

@Resolver()
@Auth()
export class FormAnalyticResolver {
  constructor(private readonly formAnalyticService: FormAnalyticService) {}

  @Query(returns => FormAnalyticType)
  @FormGuard()
  async formAnalytic(@Args('input') input: FormAnalyticInput): Promise<FormAnalyticType> {
    const { startAt, endAt, prevStartAt, prevEndAt } = getRangeDates(input)

    const [prev, next] = await Promise.all([
      this.formAnalyticService.summary({
        formId: input.formId,
        startAt: prevStartAt,
        endAt: prevEndAt,
        sourceChannel: input.sourceChannel,
        dedupeByIp: input.dedupeByIp
      }),
      this.formAnalyticService.summary({
        formId: input.formId,
        startAt,
        endAt,
        isNext: true,
        sourceChannel: input.sourceChannel,
        dedupeByIp: input.dedupeByIp
      })
    ])

    const prevRate = getRate(prev.avgTotalVisits, prev.avgSubmissionCount)
    const nextRate = getRate(next.avgTotalVisits, next.avgSubmissionCount)

    const result = {
      totalVisits: getChanges(prev.avgTotalVisits, next.avgTotalVisits),
      submissionCount: getChanges(prev.avgSubmissionCount, next.avgSubmissionCount),
      completeRate: {
        value: nextRate,
        change: prevRate ? nextRate - prevRate : undefined
      },
      averageTime: getChanges(prev.avgAverageTime, next.avgAverageTime, false),
      sourceBreakdown: next.sourceBreakdown || []
    }

    return result
  }

  @Query(returns => [FormQuestionAnalyticType])
  @FormGuard()
  async formQuestionAnalytics(@Form() form: FormModel, @Args('input') input: FormAnalyticInput) {
    const { startAt, endAt } = getRangeDates(input)
    const questions = flattenFields(form.fields || [])
      .filter(field => QUESTION_FIELD_KINDS.includes(field.kind))
      .map((field, index) => ({
        questionId: field.id,
        order: index + 1,
        title: helper.isValidArray(field.title)
          ? htmlUtils.serialize(field.title as any, { plain: true })
          : helper.isString(field.title)
            ? htmlUtils.plain(field.title as string)
            : undefined
      }))

    return this.formAnalyticService.questionAnalytics(
      input.formId,
      startAt,
      endAt,
      questions,
      {
        sourceChannel: input.sourceChannel,
        dedupeByIp: input.dedupeByIp
      }
    )
  }
}
