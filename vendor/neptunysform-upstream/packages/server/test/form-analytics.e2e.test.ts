import * as assert from 'assert'
import 'reflect-metadata'

process.env.FORM_ENCRYPTION_KEY = process.env.FORM_ENCRYPTION_KEY || 'analytics-e2e-secret'

const { date, timestamp } = require('@neptunysform-inc/utils')
const { CaptchaKindEnum, FieldKindEnum } = require('@neptunysform-inc/shared-types-enums')

const { FormAnalyticRangeEnum } = require('../src/model/form-analytic.model')
const { EndpointService } = require('../src/service/endpoint.service')
const { FormAnalyticService } = require('../src/service/form-analytic.service')
const { FormSessionService } = require('../src/service/form-session.service')
const { OpenFormResolver } = require('../src/resolver/endpoint/open-form.resolver')
const { UpdateFormSessionResolver } = require('../src/resolver/endpoint/update-form-session.resolver')
const { CompleteSubmissionResolver } = require('../src/resolver/endpoint/complete-submission.resolver')
const { FormAnalyticResolver } = require('../src/resolver/form/form-analytic.resolver')

type SortSpec = Record<string, 1 | -1>

function toComparable(value: any) {
  if (value && typeof value.valueOf === 'function') {
    return value.valueOf()
  }

  return value
}

function isOperatorObject(value: any) {
  return value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)
}

function matchesCondition(value: any, condition: any) {
  if (isOperatorObject(condition)) {
    if (Object.prototype.hasOwnProperty.call(condition, '$in')) {
      return condition.$in.includes(value)
    }

    if (Object.prototype.hasOwnProperty.call(condition, '$eq')) {
      return value === condition.$eq
    }

    if (
      Object.prototype.hasOwnProperty.call(condition, '$gte') &&
      toComparable(value) < toComparable(condition.$gte)
    ) {
      return false
    }

    if (
      Object.prototype.hasOwnProperty.call(condition, '$lte') &&
      toComparable(value) > toComparable(condition.$lte)
    ) {
      return false
    }

    return true
  }

  return value === condition
}

function matchesQuery(record: Record<string, any>, query: Record<string, any>) {
  return Object.entries(query).every(([key, condition]) => matchesCondition(record[key], condition))
}

function applyUpdate(record: Record<string, any>, update: Record<string, any>) {
  if (update.$set) {
    Object.assign(record, update.$set)
  }

  if (update.$inc) {
    Object.entries(update.$inc).forEach(([key, amount]) => {
      record[key] = (record[key] || 0) + Number(amount)
    })
  }
}

function average(values: number[]) {
  if (values.length < 1) {
    return 0
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function sortRecords<T extends Record<string, any>>(records: T[], sort: SortSpec) {
  const [key, direction] = Object.entries(sort)[0]
  const dir = direction === -1 ? -1 : 1

  return [...records].sort((left, right) => {
    const leftValue = toComparable(left[key])
    const rightValue = toComparable(right[key])

    if (leftValue === rightValue) {
      return 0
    }

    return leftValue > rightValue ? dir : -dir
  })
}

class FakeQuery<T> implements PromiseLike<T> {
  constructor(
    private readonly exec: () => Promise<T>,
    private readonly sortExec?: (sort: SortSpec) => Promise<T>
  ) {}

  sort(sort: SortSpec) {
    if (!this.sortExec) {
      return this
    }

    return new FakeQuery(() => this.sortExec!(sort), this.sortExec)
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.exec().then(onfulfilled as any, onrejected as any)
  }
}

class FakeFormOpenHistoryModel {
  public rows: Array<Record<string, any>> = []

  private filter(query: Record<string, any>) {
    return this.rows.filter(row => matchesQuery(row, query))
  }

  async find(query: Record<string, any>) {
    return this.filter(query)
  }

  findOne(query: Record<string, any>) {
    return new FakeQuery(
      async () => this.filter(query)[0] || null,
      async sort => sortRecords(this.filter(query), sort)[0] || null
    )
  }

  async create(document: Record<string, any>) {
    const id = document._id || `session_${this.rows.length + 1}`
    const row = {
      ...document,
      _id: id,
      id,
      questionMetrics: document.questionMetrics || []
    }

    this.rows.push(row)
    return row
  }

  async updateOne(query: Record<string, any>, update: Record<string, any>) {
    const row = this.filter(query)[0]

    if (!row) {
      return {
        acknowledged: false,
        matchedCount: 0
      }
    }

    applyUpdate(row, update)

    return {
      acknowledged: true,
      matchedCount: 1
    }
  }

  async countDocuments(query: Record<string, any>) {
    return this.filter(query).length
  }

  async aggregate(pipeline: Array<Record<string, any>>) {
    const match = pipeline.find(stage => stage.$match)?.$match || {}
    const rows = this.filter(match)

    if (pipeline.some(stage => stage.$unwind?.path === '$questionMetrics')) {
      const grouped = new Map<string, Record<string, any>>()

      rows.forEach(row => {
        ;(row.questionMetrics || []).forEach((metric: Record<string, any>) => {
          const current = grouped.get(metric.questionId) || {
            _id: metric.questionId,
            order: metric.order,
            title: metric.title,
            reachCount: 0,
            totalDurationMs: 0,
            completedCount: 0
          }

          current.order = metric.order
          current.title = metric.title
          current.reachCount += metric.views > 0 ? 1 : 0
          current.totalDurationMs += metric.totalDurationMs || 0
          current.completedCount += metric.completed ? 1 : 0

          grouped.set(metric.questionId, current)
        })
      })

      return sortRecords(Array.from(grouped.values()), { order: 1 })
    }

    if (pipeline.some(stage => stage.$group?.submissions)) {
      if (rows.length < 1) {
        return []
      }

      return [
        {
          _id: null,
          submissions: rows.length,
          averageTime: average(
            rows
              .map(row => row.totalDurationMs)
              .filter((value: any) => typeof value === 'number')
          )
        }
      ]
    }

    if (pipeline.some(stage => stage.$group?._id === '$variantFormId')) {
      const grouped = new Map<string, Record<string, any>>()

      rows.forEach(row => {
        const key = row.variantFormId
        const current = grouped.get(key) || {
          _id: key,
          visits: 0,
          submissions: 0,
          averageTimeValues: [] as number[]
        }

        current.visits += 1
        current.submissions += row.status === 'completed' ? 1 : 0

        if (row.status === 'completed' && typeof row.totalDurationMs === 'number') {
          current.averageTimeValues.push(row.totalDurationMs)
        }

        grouped.set(key, current)
      })

      return Array.from(grouped.values()).map(row => ({
        _id: row._id,
        visits: row.visits,
        submissions: row.submissions,
        averageTime: average(row.averageTimeValues)
      }))
    }

    return []
  }
}

class FakeFormAnalyticModel {
  public rows: Array<Record<string, any>> = []

  private filter(query: Record<string, any>) {
    return this.rows.filter(row => matchesQuery(row, query))
  }

  findOne(query: Record<string, any>) {
    return new FakeQuery(async () => this.filter(query)[0] || null)
  }

  async create(document: Record<string, any>) {
    const id = document._id || `analytic_${this.rows.length + 1}`
    const row = {
      ...document,
      _id: id,
      id,
      createdAt: document.createdAt || new Date()
    }

    this.rows.push(row)
    return row
  }

  async updateOne(query: Record<string, any>, update: Record<string, any>) {
    const row = this.filter(query)[0]

    if (!row) {
      return {
        acknowledged: false,
        matchedCount: 0
      }
    }

    applyUpdate(row, update)

    return {
      acknowledged: true,
      matchedCount: 1
    }
  }

  async aggregate(pipeline: Array<Record<string, any>>) {
    const match = pipeline.find(stage => stage.$match)?.$match || {}
    const rows = this.filter(match)

    if (rows.length < 1) {
      return []
    }

    return [
      {
        _id: null,
        avgTotalVisits: average(rows.map(row => row.totalVisits || 0))
      }
    ]
  }
}

function createContext(anonymousId: string, clientIp = '127.0.0.1') {
  return {
    req: {
      get: (header: string) =>
        header.toLowerCase() === 'x-anonymous-id'
          ? anonymousId
          : header.toLowerCase() === 'x-forwarded-for'
            ? clientIp
            : undefined,
      ip: clientIp
    }
  }
}

function createHarness() {
  const formOpenHistoryModel = new FakeFormOpenHistoryModel()
  const formAnalyticModel = new FakeFormAnalyticModel()
  const createdSubmissions: Array<Record<string, any>> = []

  const form = {
    id: 'form_analytics',
    projectId: 'project_analytics',
    teamId: 'team_analytics',
    name: 'Analytics E2E',
    suspended: false,
    settings: {
      active: true,
      captchaKind: CaptchaKindEnum.NONE,
      allowArchive: true
    },
    fields: [
      {
        id: 'question_1',
        title: 'What is your call sign?',
        kind: FieldKindEnum.SHORT_TEXT,
        validations: {
          required: true
        }
      }
    ],
    logics: [],
    variables: []
  }

  const formService = {
    findById: async (formId: string) => (formId === form.id ? form : null)
  }

  const submissionService = {
    create: async (payload: Record<string, any>) => {
      const id = `submission_${createdSubmissions.length + 1}`
      createdSubmissions.push({
        id,
        ...payload
      })

      return id
    },
    findPartialBySession: async (formId: string, sessionId: string) =>
      createdSubmissions.find(
        submission =>
          submission.formId === formId &&
          submission.sessionId === sessionId &&
          submission.isPartial === true
      ) || null,
    updateSubmission: async (submissionId: string, payload: Record<string, any>) => {
      const submission = createdSubmissions.find(row => row.id === submissionId)

      if (!submission) {
        return false
      }

      Object.assign(submission, payload)
      return true
    },
    countInForm: async (formId: string) =>
      createdSubmissions.filter(submission => submission.formId === formId).length,
    analytic: async () => [],
    updateAnswer: async () => true
  }

  const endpointService = new EndpointService()
  const formSessionService = new FormSessionService(formOpenHistoryModel as any)
  const formAnalyticService = new FormAnalyticService(
    formAnalyticModel as any,
    formSessionService,
    submissionService as any
  )

  return {
    createdSubmissions,
    endpointService,
    form,
    formAnalyticModel,
    formOpenHistoryModel,
    openFormResolver: new OpenFormResolver(
      formService as any,
      formAnalyticService,
      formSessionService
    ),
    updateFormSessionResolver: new UpdateFormSessionResolver(
      endpointService,
      formService as any,
      formSessionService
    ),
    completeSubmissionResolver: new CompleteSubmissionResolver(
      endpointService,
      formService as any,
      submissionService as any,
      {
        checkIp: async () => true
      } as any,
      {
        addQueue: () => undefined
      } as any,
      formSessionService,
      {
        addQueue: () => undefined
      } as any,
      {
        createPaymentIntent: async () => undefined
      } as any
    ),
    formAnalyticResolver: new FormAnalyticResolver(formAnalyticService, formService as any)
  }
}

async function testAnalyticsFlowFromOpenToSummary() {
  const harness = createHarness()

  const firstOpenToken = await harness.openFormResolver.openForm(createContext('anon_a'), {
    formId: harness.form.id,
    landingUrl: 'https://example.com/form/analytics',
    referrer: 'https://example.com'
  })
  const firstOpenPayload = harness.endpointService.decryptToken(firstOpenToken)

  assert.ok(firstOpenPayload.sessionId)
  assert.strictEqual(harness.formOpenHistoryModel.rows.length, 1)
  assert.strictEqual(harness.formAnalyticModel.rows[0]?.totalVisits, 1)

  const refreshOpenToken = await harness.openFormResolver.openForm(createContext('anon_a'), {
    formId: harness.form.id,
    landingUrl: 'https://example.com/form/analytics',
    referrer: 'https://example.com'
  })
  const refreshOpenPayload = harness.endpointService.decryptToken(refreshOpenToken)

  assert.strictEqual(refreshOpenPayload.sessionId, firstOpenPayload.sessionId)
  assert.strictEqual(harness.formOpenHistoryModel.rows.length, 1)
  assert.strictEqual(harness.formAnalyticModel.rows[0]?.totalVisits, 1)

  const firstSessionUpdated = await harness.updateFormSessionResolver.updateFormSession({
    formId: harness.form.id,
    openToken: firstOpenToken,
    metrics: [
      {
        questionId: 'question_1',
        order: 1,
        title: 'What is your call sign?',
        views: 1,
        totalDurationMs: 2500,
        completed: true
      }
    ],
    lastQuestionId: 'question_1',
    lastQuestionOrder: 1
  })

  assert.strictEqual(firstSessionUpdated, true)

  const firstSession = harness.formOpenHistoryModel.rows.find(
    row => row.id === firstOpenPayload.sessionId
  )
  assert.ok(firstSession)

  firstSession.startAt = timestamp() - 12
  firstSession.lastSeenAt = firstSession.startAt

  const submitResult = await harness.completeSubmissionResolver.completeSubmission(
    {
      ip: '127.0.0.1',
      userAgent: 'analytics-e2e-test'
    },
    {
      formId: harness.form.id,
      answers: {
        question_1: 'Alpha'
      },
      hiddenFields: [],
      openToken: firstOpenToken
    }
  )

  assert.deepStrictEqual(submitResult, {})
  assert.strictEqual(harness.createdSubmissions.length, 1)
  assert.strictEqual(firstSession.status, 'completed')
  assert.ok(firstSession.totalDurationMs >= 12)

  const secondOpenToken = await harness.openFormResolver.openForm(createContext('anon_b'), {
    formId: harness.form.id,
    landingUrl: 'https://example.com/form/analytics',
    referrer: 'https://example.com/drop-off'
  })
  const secondOpenPayload = harness.endpointService.decryptToken(secondOpenToken)

  assert.notStrictEqual(secondOpenPayload.sessionId, firstOpenPayload.sessionId)
  assert.strictEqual(harness.formOpenHistoryModel.rows.length, 2)
  assert.strictEqual(harness.formAnalyticModel.rows[0]?.totalVisits, 2)

  const secondSessionUpdated = await harness.updateFormSessionResolver.updateFormSession({
    formId: harness.form.id,
    openToken: secondOpenToken,
    metrics: [
      {
        questionId: 'question_1',
        order: 1,
        title: 'What is your call sign?',
        views: 1,
        totalDurationMs: 1300,
        completed: false
      }
    ],
    lastQuestionId: 'question_1',
    lastQuestionOrder: 1
  })

  assert.strictEqual(secondSessionUpdated, true)

  const overview = await harness.formAnalyticResolver.formAnalytic({
    formId: harness.form.id,
    range: FormAnalyticRangeEnum.WEEK
  })

  assert.strictEqual(overview.totalVisits.value, 2)
  assert.strictEqual(overview.submissionCount.value, 1)
  assert.strictEqual(overview.completeRate.value, 50)
  assert.ok(overview.averageTime.value >= 12)

  const questions = await harness.formAnalyticResolver.formQuestionAnalytics({
    formId: harness.form.id,
    range: FormAnalyticRangeEnum.WEEK
  })

  assert.strictEqual(questions.length, 1)
  assert.strictEqual(questions[0].questionId, 'question_1')
  assert.strictEqual(questions[0].reachCount, 2)
  assert.strictEqual(questions[0].completedCount, 1)
  assert.strictEqual(questions[0].dropOffCount, 1)
  assert.strictEqual(questions[0].dropOffRate, 50)
  assert.strictEqual(questions[0].averageDuration, 1.9)
  assert.strictEqual(questions[0].frictionLevel, 'high')
  assert.deepStrictEqual(overview.sourceBreakdown, [
    {
      channel: 'other',
      totalVisits: 2,
      submissionCount: 1
    }
  ])
}

async function testRefreshReuseExpiresAfterThirtyMinutes() {
  const harness = createHarness()

  const firstOpenToken = await harness.openFormResolver.openForm(createContext('anon_window'), {
    formId: harness.form.id
  })
  const firstOpenPayload = harness.endpointService.decryptToken(firstOpenToken)
  const firstSession = harness.formOpenHistoryModel.rows.find(
    row => row.id === firstOpenPayload.sessionId
  )

  assert.ok(firstSession)

  firstSession.lastSeenAt = timestamp() - 31 * 60

  const reopenedToken = await harness.openFormResolver.openForm(createContext('anon_window'), {
    formId: harness.form.id
  })
  const reopenedPayload = harness.endpointService.decryptToken(reopenedToken)

  assert.notStrictEqual(reopenedPayload.sessionId, firstOpenPayload.sessionId)
  assert.strictEqual(harness.formOpenHistoryModel.rows.length, 2)
  assert.strictEqual(harness.formAnalyticModel.rows[0]?.totalVisits, 2)
}

async function testAnalyticsCanFilterBySourceAndDedupeByIp() {
  const harness = createHarness()

  const metaOpenTokenA = await harness.openFormResolver.openForm(createContext('anon_meta_a', '10.0.0.1'), {
    formId: harness.form.id,
    utmSource: 'facebook',
    referrer: 'https://m.facebook.com'
  })
  const metaPayloadA = harness.endpointService.decryptToken(metaOpenTokenA)

  await harness.updateFormSessionResolver.updateFormSession({
    formId: harness.form.id,
    openToken: metaOpenTokenA,
    metrics: [
      {
        questionId: 'question_1',
        order: 1,
        title: 'What is your call sign?',
        views: 1,
        totalDurationMs: 2200,
        completed: true
      }
    ],
    lastQuestionId: 'question_1',
    lastQuestionOrder: 1
  })

  const metaSessionA = harness.formOpenHistoryModel.rows.find(row => row.id === metaPayloadA.sessionId)
  assert.ok(metaSessionA)
  metaSessionA.startAt = timestamp() - 10
  metaSessionA.lastSeenAt = metaSessionA.startAt

  await harness.completeSubmissionResolver.completeSubmission(
    {
      ip: '10.0.0.1',
      userAgent: 'analytics-e2e-test'
    },
    {
      formId: harness.form.id,
      answers: {
        question_1: 'Alpha'
      },
      hiddenFields: [],
      openToken: metaOpenTokenA
    }
  )

  const metaOpenTokenB = await harness.openFormResolver.openForm(createContext('anon_meta_b', '10.0.0.1'), {
    formId: harness.form.id,
    utmSource: 'facebook',
    referrer: 'https://m.facebook.com'
  })

  await harness.updateFormSessionResolver.updateFormSession({
    formId: harness.form.id,
    openToken: metaOpenTokenB,
    metrics: [
      {
        questionId: 'question_1',
        order: 1,
        title: 'What is your call sign?',
        views: 1,
        totalDurationMs: 900,
        completed: false
      }
    ],
    lastQuestionId: 'question_1',
    lastQuestionOrder: 1
  })

  await harness.openFormResolver.openForm(createContext('anon_direct', '10.0.0.2'), {
    formId: harness.form.id,
    landingUrl: 'https://example.com/direct'
  })

  const metaOverview = await harness.formAnalyticResolver.formAnalytic({
    formId: harness.form.id,
    range: FormAnalyticRangeEnum.WEEK,
    sourceChannel: 'meta',
    dedupeByIp: true
  })

  assert.strictEqual(metaOverview.totalVisits.value, 1)
  assert.strictEqual(metaOverview.submissionCount.value, 1)
  assert.strictEqual(metaOverview.completeRate.value, 100)
  assert.deepStrictEqual(metaOverview.sourceBreakdown, [
    {
      channel: 'meta',
      totalVisits: 1,
      submissionCount: 1
    }
  ])

  const dedupedQuestions = await harness.formAnalyticResolver.formQuestionAnalytics({
    formId: harness.form.id,
    range: FormAnalyticRangeEnum.WEEK,
    sourceChannel: 'meta',
    dedupeByIp: true
  })

  assert.strictEqual(dedupedQuestions.length, 1)
  assert.strictEqual(dedupedQuestions[0].reachCount, 1)
  assert.strictEqual(dedupedQuestions[0].completedCount, 1)
}

async function testAnalyticsSupportsTodayAndCustomRanges() {
  const harness = createHarness()

  const todayOpenToken = await harness.openFormResolver.openForm(createContext('anon_today', '10.0.0.3'), {
    formId: harness.form.id
  })
  const todayPayload = harness.endpointService.decryptToken(todayOpenToken)

  await harness.updateFormSessionResolver.updateFormSession({
    formId: harness.form.id,
    openToken: todayOpenToken,
    metrics: [
      {
        questionId: 'question_1',
        order: 1,
        title: 'What is your call sign?',
        views: 1,
        totalDurationMs: 2100,
        completed: true
      }
    ],
    lastQuestionId: 'question_1',
    lastQuestionOrder: 1
  })

  const todaySession = harness.formOpenHistoryModel.rows.find(row => row.id === todayPayload.sessionId)
  assert.ok(todaySession)
  todaySession.startAt = timestamp() - 60
  todaySession.lastSeenAt = todaySession.startAt

  await harness.completeSubmissionResolver.completeSubmission(
    {
      ip: '10.0.0.3',
      userAgent: 'analytics-e2e-test'
    },
    {
      formId: harness.form.id,
      answers: {
        question_1: 'Bravo'
      },
      hiddenFields: [],
      openToken: todayOpenToken
    }
  )

  const customOpenToken = await harness.openFormResolver.openForm(createContext('anon_custom', '10.0.0.4'), {
    formId: harness.form.id
  })
  const customPayload = harness.endpointService.decryptToken(customOpenToken)

  await harness.updateFormSessionResolver.updateFormSession({
    formId: harness.form.id,
    openToken: customOpenToken,
    metrics: [
      {
        questionId: 'question_1',
        order: 1,
        title: 'What is your call sign?',
        views: 1,
        totalDurationMs: 1800,
        completed: false
      }
    ],
    lastQuestionId: 'question_1',
    lastQuestionOrder: 1
  })

  const customSession = harness.formOpenHistoryModel.rows.find(row => row.id === customPayload.sessionId)
  assert.ok(customSession)
  customSession.startAt = timestamp() - 3 * 24 * 60 * 60
  customSession.lastSeenAt = customSession.startAt

  const todayOverview = await harness.formAnalyticResolver.formAnalytic({
    formId: harness.form.id,
    range: FormAnalyticRangeEnum.TODAY
  })

  assert.strictEqual(todayOverview.totalVisits.value, 1)
  assert.strictEqual(todayOverview.submissionCount.value, 1)
  assert.strictEqual(todayOverview.completeRate.value, 100)

  const customOverview = await harness.formAnalyticResolver.formAnalytic({
    formId: harness.form.id,
    range: FormAnalyticRangeEnum.CUSTOM,
    startDate: date().subtract(4, 'days').format('YYYY-MM-DD'),
    endDate: date().subtract(2, 'days').format('YYYY-MM-DD')
  })

  assert.strictEqual(customOverview.totalVisits.value, 1)
  assert.strictEqual(customOverview.submissionCount.value, 0)

  const customQuestions = await harness.formAnalyticResolver.formQuestionAnalytics({
    formId: harness.form.id,
    range: FormAnalyticRangeEnum.CUSTOM,
    startDate: date().subtract(4, 'days').format('YYYY-MM-DD'),
    endDate: date().subtract(2, 'days').format('YYYY-MM-DD')
  })

  assert.strictEqual(customQuestions.length, 1)
  assert.strictEqual(customQuestions[0].reachCount, 1)
  assert.strictEqual(customQuestions[0].completedCount, 0)
}

async function run() {
  await testAnalyticsFlowFromOpenToSummary()
  await testRefreshReuseExpiresAfterThirtyMinutes()
  await testAnalyticsCanFilterBySourceAndDedupeByIp()
  await testAnalyticsSupportsTodayAndCustomRanges()
}

if (require.main === module) {
  run()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log('analytics_e2e=ok')
    })
    .catch((error: any) => {
      // eslint-disable-next-line no-console
      console.error(error)
      process.exitCode = 1
    })
}