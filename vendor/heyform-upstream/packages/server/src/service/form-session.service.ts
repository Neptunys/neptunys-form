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
const SOURCE_CHANNEL_ORDER = [
  'direct',
  'meta',
  'google',
  'linkedin',
  'x',
  'youtube',
  'tiktok',
  'email',
  'other'
] as const

type SourceChannel = (typeof SOURCE_CHANNEL_ORDER)[number]

interface AnalyticsFilterOptions {
  sourceChannel?: string
  dedupeByIp?: boolean
}

interface SourceBreakdownItem {
  channel: string
  totalVisits: number
  submissionCount: number
}

interface AnalyticsSession {
  id?: string
  _id?: string
  anonymousId?: string
  ip?: string
  status?: FormSessionStatusEnum
  startAt: number
  lastSeenAt: number
  completedAt?: number
  totalDurationMs?: number
  lastQuestionOrder?: number
  source?: Record<string, any>
  questionMetrics?: FormSessionQuestionMetricModel[]
}

function normalizeQuestionMetrics(metrics: FormSessionQuestionMetricModel[]) {
  return metrics.map(metric => ({
    ...metric,
    totalDurationMs: Math.max(0, metric.totalDurationMs / 1000)
  }))
}

function normalizeSourceValue(value?: string) {
  if (!helper.isValid(value)) {
    return undefined
  }

  return String(value).trim().toLowerCase()
}

function includesAny(value: string | undefined, patterns: string[]) {
  return helper.isValid(value) && patterns.some(pattern => value!.includes(pattern))
}

function parseHostname(value?: string) {
  if (!helper.isValid(value)) {
    return undefined
  }

  try {
    const url = new URL(value!)
    return url.hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return undefined
  }
}

function mapSourceChannel(value?: string): SourceChannel | undefined {
  const normalized = normalizeSourceValue(value)

  if (!helper.isValid(normalized) || normalized === 'all') {
    return undefined
  }

  if (includesAny(normalized, ['facebook', 'instagram', 'messenger', 'whatsapp', 'meta', 'fb', 'ig'])) {
    return 'meta'
  }

  if (includesAny(normalized, ['google', 'adwords', 'gclid', 'googleads'])) {
    return 'google'
  }

  if (includesAny(normalized, ['linkedin', 'lnkd'])) {
    return 'linkedin'
  }

  if (includesAny(normalized, ['twitter', 't.co', ' x ', 'x.com']) || normalized === 'x') {
    return 'x'
  }

  if (includesAny(normalized, ['youtube', 'youtu.be'])) {
    return 'youtube'
  }

  if (includesAny(normalized, ['tiktok'])) {
    return 'tiktok'
  }

  if (includesAny(normalized, ['email', 'newsletter', 'mail'])) {
    return 'email'
  }

  if (includesAny(normalized, ['direct', '(direct)', 'typed', 'none'])) {
    return 'direct'
  }

  if (SOURCE_CHANNEL_ORDER.includes(normalized as SourceChannel)) {
    return normalized as SourceChannel
  }

  return undefined
}

function resolveSourceChannel(source?: Record<string, any>): SourceChannel {
  const explicitChannel = mapSourceChannel(source?.channel)

  if (explicitChannel) {
    return explicitChannel
  }

  const utmChannel = mapSourceChannel(source?.utmSource) || mapSourceChannel(source?.utmMedium)

  if (utmChannel) {
    return utmChannel
  }

  const referrerHost = parseHostname(source?.referrer)

  if (!helper.isValid(referrerHost)) {
    return 'direct'
  }

  if (
    includesAny(referrerHost, [
      'facebook.com',
      'fb.com',
      'instagram.com',
      'messenger.com',
      'm.me',
      'whatsapp.com'
    ])
  ) {
    return 'meta'
  }

  if (includesAny(referrerHost, ['google.', 'googlesyndication.com'])) {
    return 'google'
  }

  if (includesAny(referrerHost, ['linkedin.com'])) {
    return 'linkedin'
  }

  if (includesAny(referrerHost, ['twitter.com', 'x.com', 't.co'])) {
    return 'x'
  }

  if (includesAny(referrerHost, ['youtube.com', 'youtu.be'])) {
    return 'youtube'
  }

  if (includesAny(referrerHost, ['tiktok.com'])) {
    return 'tiktok'
  }

  if (includesAny(referrerHost, ['mail.', 'outlook.', 'gmail.', 'yahoo.', 'proton.'])) {
    return 'email'
  }

  return 'other'
}

function toAnalyticsSession(session: AnalyticsSession): AnalyticsSession {
  const source = {
    ...(session.source || {})
  }

  return {
    ...session,
    source: {
      ...source,
      channel: resolveSourceChannel(source)
    }
  }
}

function getAnalyticsSessionKey(session: AnalyticsSession) {
  if (helper.isValid(session.ip)) {
    return `ip:${session.ip}`
  }

  if (helper.isValid(session.anonymousId)) {
    return `anonymous:${session.anonymousId}`
  }

  return `session:${session.id || session._id}`
}

function getAnalyticsSessionProgress(session: AnalyticsSession) {
  return Math.max(
    session.lastQuestionOrder || 0,
    ...(session.questionMetrics || []).map(metric => metric.order || 0)
  )
}

function isPreferredAnalyticsSession(candidate: AnalyticsSession, current: AnalyticsSession) {
  const candidateCompleted = candidate.status === FormSessionStatusEnum.COMPLETED ? 1 : 0
  const currentCompleted = current.status === FormSessionStatusEnum.COMPLETED ? 1 : 0

  if (candidateCompleted !== currentCompleted) {
    return candidateCompleted > currentCompleted
  }

  const candidateProgress = getAnalyticsSessionProgress(candidate)
  const currentProgress = getAnalyticsSessionProgress(current)

  if (candidateProgress !== currentProgress) {
    return candidateProgress > currentProgress
  }

  const candidateTimestamp = candidate.completedAt || candidate.lastSeenAt || candidate.startAt || 0
  const currentTimestamp = current.completedAt || current.lastSeenAt || current.startAt || 0

  if (candidateTimestamp !== currentTimestamp) {
    return candidateTimestamp > currentTimestamp
  }

  return String(candidate.id || candidate._id) > String(current.id || current._id)
}

function average(values: number[]) {
  if (values.length < 1) {
    return 0
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

interface CreateFormSessionOptions {
  formId: string
  projectId: string
  teamId: string
  anonymousId: string
  ip?: string
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

  async findBySessionId(sessionId: string, formId: string): Promise<FormOpenHistoryModel | null> {
    return this.formOpenHistoryModel.findOne({
      _id: sessionId,
      formId
    })
  }

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

      nextSource.channel = resolveSourceChannel(nextSource)

      await this.formOpenHistoryModel.updateOne(
        { _id: existingSession.id },
        {
          $set: {
            lastSeenAt: now,
            ip: existingSession.ip || options.ip,
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
      ip: options.ip,
      experimentId: options.experimentId,
      variantFormId: options.variantFormId || options.formId,
      status: FormSessionStatusEnum.ACTIVE,
      startAt: now,
      lastSeenAt: now,
      source: {
        ...(options.source || {}),
        channel: resolveSourceChannel(options.source)
      },
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

  private async listAnalyticsSessions(formId: string, startAt: number, endAt: number) {
    const sessions = await this.formOpenHistoryModel.find({
      formId,
      startAt: {
        $gte: startAt,
        $lte: endAt
      }
    })

    return helper.isValidArray(sessions) ? (sessions as AnalyticsSession[]) : []
  }

  private async getAnalyticsSessions(
    formId: string,
    startAt: number,
    endAt: number,
    filters: AnalyticsFilterOptions = {}
  ) {
    let sessions = (await this.listAnalyticsSessions(formId, startAt, endAt)).map(toAnalyticsSession)
    const requestedChannel = mapSourceChannel(filters.sourceChannel)

    if (requestedChannel) {
      sessions = sessions.filter(session => session.source?.channel === requestedChannel)
    }

    if (filters.dedupeByIp) {
      const uniqueSessions = new Map<string, AnalyticsSession>()

      sessions.forEach(session => {
        const key = getAnalyticsSessionKey(session)
        const current = uniqueSessions.get(key)

        if (!current || isPreferredAnalyticsSession(session, current)) {
          uniqueSessions.set(key, session)
        }
      })

      sessions = Array.from(uniqueSessions.values())
    }

    return sessions
  }

  private getSourceBreakdown(sessions: AnalyticsSession[]): SourceBreakdownItem[] {
    const grouped = new Map<string, SourceBreakdownItem>()

    sessions.forEach(session => {
      const channel = session.source?.channel || 'other'
      const row = grouped.get(channel) || {
        channel,
        totalVisits: 0,
        submissionCount: 0
      }

      row.totalVisits += 1

      if (session.status === FormSessionStatusEnum.COMPLETED) {
        row.submissionCount += 1
      }

      grouped.set(channel, row)
    })

    const ordered = SOURCE_CHANNEL_ORDER.map(channel => grouped.get(channel)).filter(Boolean)
    const rest = Array.from(grouped.values()).filter(row => !SOURCE_CHANNEL_ORDER.includes(row.channel as SourceChannel))

    return [...ordered, ...rest] as SourceBreakdownItem[]
  }

  async getSummary(
    formId: string,
    startAt: number,
    endAt: number,
    filters: AnalyticsFilterOptions = {}
  ) {
    const sessions = await this.getAnalyticsSessions(formId, startAt, endAt, filters)
    const completedSessions = sessions.filter(
      session => session.status === FormSessionStatusEnum.COMPLETED
    )
    const totalVisits = sessions.length
    const submissions = completedSessions.length
    const averageTime = average(
      completedSessions
        .map(session => session.totalDurationMs)
        .filter((value): value is number => typeof value === 'number')
    )

    return {
      totalVisits,
      submissionCount: submissions,
      averageTime,
      completeRate: totalVisits > 0 ? (submissions / totalVisits) * 100 : 0,
      sourceBreakdown: this.getSourceBreakdown(sessions)
    }
  }

  async getQuestionAnalytics(
    formId: string,
    startAt: number,
    endAt: number,
    filters: AnalyticsFilterOptions = {}
  ) {
    const sessions = await this.getAnalyticsSessions(formId, startAt, endAt, filters)
    const totalVisits = sessions.length
    const completedSessions = sessions.filter(
      session => session.status === FormSessionStatusEnum.COMPLETED
    ).length
    const grouped = new Map<string, Record<string, any>>()

    sessions.forEach(session => {
      ;(session.questionMetrics || []).forEach(metric => {
        const row = grouped.get(metric.questionId) || {
          _id: metric.questionId,
          order: metric.order,
          title: metric.title,
          reachCount: 0,
          totalDurationMs: 0,
          completedCount: 0
        }

        row.order = metric.order
        row.title = metric.title
        row.reachCount += metric.views > 0 ? 1 : 0
        row.totalDurationMs += metric.totalDurationMs || 0
        row.completedCount += metric.completed ? 1 : 0
        grouped.set(metric.questionId, row)
      })
    })

    const rows = Array.from(grouped.values()).sort((left, right) => left.order - right.order)

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