import { createHash } from 'crypto'

import { answersToHtml, htmlUtils, parsePlainAnswer } from '@heyform-inc/answer-utils'
import {
  Answer,
  CHOICE_FIELD_KINDS,
  ContactInfoValue,
  FieldKindEnum,
  FormField,
  HiddenField,
  Variable
} from '@heyform-inc/shared-types-enums'

import { helper } from '@heyform-inc/utils'

const DEFAULT_LEAD_PRIORITY_LABELS = {
  high: 'Hot',
  medium: 'Warm',
  low: 'Cold'
}

const DEFAULT_LEAD_QUALITY_LABELS = {
  high: 'Qualified',
  medium: 'Review',
  low: 'Low fit'
}

const DEFAULT_RESPONDENT_NOTIFICATION_SUBJECT = 'We received your submission for {formName}'
const DEFAULT_RESPONDENT_NOTIFICATION_MESSAGE =
  'Hi {respondentName},\n\nThanks for your submission to {formName}. We received it on {submittedAt}. A team member will review it and follow up if needed.'
const DEFAULT_NEGATIVE_RESPONDENT_NOTIFICATION_SUBJECT = 'Your result for {formName}'
const DEFAULT_NEGATIVE_RESPONDENT_NOTIFICATION_MESSAGE =
  'Hi {respondentName},\n\nThanks for completing {formName}. Based on your answers, this result is negative right now. We recorded your submission on {submittedAt}.'

const NON_QUESTION_FIELD_KINDS = [
  FieldKindEnum.GROUP,
  FieldKindEnum.STATEMENT,
  FieldKindEnum.WELCOME,
  FieldKindEnum.THANK_YOU,
  FieldKindEnum.HIDDEN_FIELDS,
  FieldKindEnum.VARIABLE,
  FieldKindEnum.SUBMIT_DATE
]

interface LeadAwareForm {
  id?: string
  projectId?: string
  name: string
  settings?: Record<string, any>
  fields?: FormField[]
  hiddenFields?: HiddenField[]
  variables?: Variable[]
}

interface LeadAwareProject {
  id?: string
  name?: string
  reportingTimezone?: string
}

interface LeadAwareSubmission {
  id?: string
  answers: Answer[]
  hiddenFields?: Array<{
    id: string
    value?: string
  }>
  variables?: Variable[]
  endAt?: number
}

interface LeadAwareTeam {
  clientName?: string
  leadNotificationEmails?: string[]
  reportingTimezone?: string
}

interface LeadFlowSettings {
  enableEmailNotification?: boolean
  enableLeadScoring?: boolean
  leadScoreVariableId?: string
  leadMediumThreshold?: number
  leadHighThreshold?: number
  leadQualityLowLabel?: string
  leadQualityMediumLabel?: string
  leadQualityHighLabel?: string
  leadPriorityLowLabel?: string
  leadPriorityMediumLabel?: string
  leadPriorityHighLabel?: string
  respondentNameFieldId?: string
  respondentEmailFieldId?: string
  respondentPhoneFieldId?: string
  enableRespondentNotification?: boolean
  respondentNotificationSubject?: string
  respondentNotificationMessage?: string
  respondentNegativeNotificationSubject?: string
  respondentNegativeNotificationMessage?: string
  enableOperatorNotification?: boolean
  operatorNotificationEmails?: string[]
  operatorNotificationSubject?: string
  operatorNotificationMessage?: string
}

type LeadLevel = 'high' | 'medium' | 'low'
type LeadIdentitySource = 'email' | 'phone' | 'name' | 'submission'
type ScoredChoiceLike = {
  id: string
  score?: unknown
}

const TEST_LEAD_PERSONAS: Record<
  LeadLevel,
  {
    respondentName: string
    respondentEmail: string
    respondentPhone: string
    answerTone: string
    choiceLabel: string
    url: string
    address: string
    payment: string
  }
> = {
  high: {
    respondentName: 'High Intent Lead',
    respondentEmail: 'lead.high@example.com',
    respondentPhone: '+1 555 010 2101',
    answerTone: 'Strong fit',
    choiceLabel: 'Option A',
    url: 'https://example.com/high-fit',
    address: '12 Victory Avenue, London',
    payment: '$249.00'
  },
  medium: {
    respondentName: 'Medium Intent Lead',
    respondentEmail: 'lead.medium@example.com',
    respondentPhone: '+1 555 010 2102',
    answerTone: 'Review needed',
    choiceLabel: 'Option B',
    url: 'https://example.com/review-fit',
    address: '45 Service Road, Manchester',
    payment: '$149.00'
  },
  low: {
    respondentName: 'Low Intent Lead',
    respondentEmail: 'lead.low@example.com',
    respondentPhone: '+1 555 010 2103',
    answerTone: 'Low fit',
    choiceLabel: 'Option C',
    url: 'https://example.com/low-fit',
    address: '88 Example Street, Leeds',
    payment: '$49.00'
  }
}

const TEST_LEAD_LEVELS: LeadLevel[] = ['high', 'medium', 'low']
const DERIVED_LEAD_SCORE_SOURCE = 'Answer scores'
const TEST_TRAFFIC_SOURCES = [
  'Meta',
  'Google',
  'Direct',
  'LinkedIn',
  'Email',
  'TikTok',
  'YouTube',
  'X'
]

export interface LeadCapturePayload {
  clientName?: string
  formId: string
  formName: string
  projectId?: string
  projectName?: string
  submissionId: string
  userId: string
  userIdSource: LeadIdentitySource
  submittedAt: number
  submittedAtIso: string
  respondentName?: string
  respondentEmail?: string
  respondentPhone?: string
  trafficSource?: string
  leadScore?: number
  leadScoreVariableId?: string
  leadScoreVariableName?: string
  leadLevel?: LeadLevel
  hasZeroScoreAnswer?: boolean
  leadQuality?: string
  leadPriority?: string
  answerItems?: LeadAnswerItem[]
  answersByTitle: Record<string, string>
  hiddenFieldsByName: Record<string, string>
  variablesByName: Record<string, string | number>
  answersPlain: string
  answersHtml: string
  reportingTimezone?: string
}

export type LeadAnswerSheetRow = Record<string, string> & {
  'Lead ID': string
  'Quiz Name': string
  'Submitted At': string
}

export interface LeadAnswerItem {
  fieldId: string
  question: string
  answer: string
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toTokenSlug(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return helper.isValid(normalized) ? normalized : 'value'
}

function asPlainText(value: unknown): string {
  if (Array.isArray(value)) {
    return htmlUtils.plain(htmlUtils.serialize(value as any))
  }

  if (helper.isNil(value)) {
    return ''
  }

  return String(value).trim()
}

function normalizeString(value: unknown): string | undefined {
  const normalized = asPlainText(value)
  return helper.isValid(normalized) ? normalized : undefined
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && helper.isValid(value)) {
    const parsed = Number(value)

    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return undefined
}

function formatUtcDateTime(value: string | undefined): string {
  const normalized = normalizeString(value)

  if (!normalized) {
    return ''
  }

  return normalized.replace('T', ' ').replace(/\.\d+Z$/, ' UTC').replace(/Z$/, ' UTC')
}

function buildTaggedEmail(email: string, sampleIndex: number): string {
  const separatorIndex = email.indexOf('@')

  if (separatorIndex === -1) {
    return email
  }

  return `${email.slice(0, separatorIndex)}+${sampleIndex + 1}${email.slice(separatorIndex)}`
}

function buildTaggedName(name: string, sampleIndex: number): string {
  return `${name} ${sampleIndex + 1}`
}

function getRecordIdentifier(record: Record<string, any> | undefined): string | undefined {
  return normalizeString(record?.id || record?._id)
}

function getFieldTitle(field?: FormField, fallback?: string): string {
  const title = field ? asPlainText(field.title) : ''

  if (helper.isValid(title)) {
    return title
  }

  if (helper.isValid(fallback)) {
    return fallback!
  }

  return 'Untitled question'
}

function getSampleAnswerValue(field: FormField, index: number, leadLevel: LeadLevel = 'high'): string {
  const persona = TEST_LEAD_PERSONAS[leadLevel]

  switch (field.kind) {
    case FieldKindEnum.FULL_NAME:
      return persona.respondentName
    case FieldKindEnum.EMAIL:
      return persona.respondentEmail
    case FieldKindEnum.PHONE_NUMBER:
      return persona.respondentPhone
    case FieldKindEnum.CONTACT_INFO:
      return [
        persona.respondentName,
        persona.respondentEmail,
        persona.respondentPhone,
        `${persona.answerTone} Company`
      ]
        .filter(Boolean)
        .join('\n')
    case FieldKindEnum.URL:
      return persona.url
    case FieldKindEnum.DATE:
      return '2026-01-15'
    case FieldKindEnum.DATE_RANGE:
      return '2026-01-15 to 2026-01-20'
    case FieldKindEnum.NUMBER:
    case FieldKindEnum.RATING:
    case FieldKindEnum.OPINION_SCALE:
      return String(
        leadLevel === 'high' ? 9 - (index % 2) : leadLevel === 'medium' ? 6 - (index % 2) : 2 + (index % 2)
      )
    case FieldKindEnum.YES_NO:
    case FieldKindEnum.LEGAL_TERMS:
      return leadLevel === 'low' ? 'No' : 'Yes'
    case FieldKindEnum.MULTIPLE_CHOICE:
    case FieldKindEnum.PICTURE_CHOICE:
      return persona.choiceLabel
    case FieldKindEnum.ADDRESS:
      return persona.address
    case FieldKindEnum.COUNTRY:
      return 'United States'
    case FieldKindEnum.FILE_UPLOAD:
      return `${leadLevel}-lead-evidence.pdf`
    case FieldKindEnum.SIGNATURE:
      return `Signed by ${persona.respondentName}`
    case FieldKindEnum.PAYMENT:
      return persona.payment
    case FieldKindEnum.INPUT_TABLE:
      return `${persona.answerTone} data row ${index + 1}`
    default:
      return `${persona.answerTone} answer ${index + 1}`
  }
}

function makeUniqueKey(target: Record<string, any>, rawKey: string, fallback: string): string {
  const baseKey = normalizeString(rawKey) || fallback
  let nextKey = baseKey
  let index = 2

  while (Object.prototype.hasOwnProperty.call(target, nextKey)) {
    nextKey = `${baseKey} (${index})`
    index += 1
  }

  return nextKey
}

function getLeadLevel(score: number | undefined, mediumThreshold: number, highThreshold: number) {
  if (!helper.isNumber(score)) {
    return undefined
  }

  if (score >= highThreshold) {
    return 'high'
  }

  if (score >= mediumThreshold) {
    return 'medium'
  }

  return 'low'
}

function getLeadLabel(
  score: number | undefined,
  mediumThreshold: number,
  highThreshold: number,
  labels: Record<'high' | 'medium' | 'low', string>
) {
  const level = getLeadLevel(score, mediumThreshold, highThreshold)
  return level ? labels[level] : undefined
}

function normalizeEmailIdentity(value: unknown): string | undefined {
  const normalized = normalizeString(value)
  return normalized ? normalized.toLowerCase() : undefined
}

function normalizePhoneIdentity(value: unknown): string | undefined {
  const normalized = normalizeString(value)

  if (!normalized) {
    return undefined
  }

  const hasPlusPrefix = normalized.startsWith('+')
  const digits = normalized.replace(/\D/g, '')

  if (!helper.isValid(digits)) {
    return undefined
  }

  return hasPlusPrefix ? `+${digits}` : digits
}

function createLeadIdentityHash(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 12)
}

function buildOpaqueLeadUserId(source: string, value: string): string {
  return `lead_${createLeadIdentityHash(`${source}:${value}`)}`
}

function buildLeadUserIdentity({
  respondentName,
  respondentEmail,
  respondentPhone,
  submissionId
}: {
  respondentName?: string
  respondentEmail?: string
  respondentPhone?: string
  submissionId?: string
}) {
  const normalizedEmail = normalizeEmailIdentity(respondentEmail)

  if (normalizedEmail) {
    return {
      userId: buildOpaqueLeadUserId('email', normalizedEmail),
      userIdSource: 'email' as const
    }
  }

  const normalizedPhone = normalizePhoneIdentity(respondentPhone)

  if (normalizedPhone) {
    return {
      userId: buildOpaqueLeadUserId('phone', normalizedPhone),
      userIdSource: 'phone' as const
    }
  }

  const normalizedName = normalizeString(respondentName)

  if (normalizedName) {
    const loweredName = normalizedName.toLowerCase()

    return {
      userId: buildOpaqueLeadUserId('name', loweredName),
      userIdSource: 'name' as const
    }
  }

  const fallbackSubmissionId = normalizeString(submissionId) || 'unknown-submission'

  return {
    userId: buildOpaqueLeadUserId('submission', fallbackSubmissionId),
    userIdSource: 'submission' as const
  }
}

function getTestLeadScore(level: LeadLevel, mediumThreshold: number, highThreshold: number) {
  if (level === 'high') {
    return highThreshold + 5
  }

  if (level === 'medium') {
    return Math.max(mediumThreshold, Math.floor((mediumThreshold + highThreshold - 1) / 2))
  }

  return Math.max(0, mediumThreshold - 5)
}

function resolveConfiguredAnswer(
  settings: LeadFlowSettings | undefined,
  answers: Answer[],
  settingKey: 'respondentNameFieldId' | 'respondentEmailFieldId' | 'respondentPhoneFieldId',
  fallbackKinds: FieldKindEnum[]
) {
  const configuredId = settings?.[settingKey]

  if (helper.isValid(configuredId)) {
    const configuredAnswer = answers.find(answer => answer.id === configuredId)

    if (configuredAnswer) {
      return configuredAnswer
    }
  }

  return answers.find(answer => fallbackKinds.includes(answer.kind))
}

function getContactInfoValue(answer?: Answer): ContactInfoValue | undefined {
  return answer?.kind === FieldKindEnum.CONTACT_INFO && helper.isObject(answer.value)
    ? (answer.value as ContactInfoValue)
    : undefined
}

function getRespondentName(answer?: Answer) {
  const contactInfo = getContactInfoValue(answer)

  if (contactInfo) {
    return normalizeString(
      [
        contactInfo.firstName ?? contactInfo.fullName?.firstName,
        contactInfo.lastName ?? contactInfo.fullName?.lastName
      ]
        .filter(Boolean)
        .join(' ')
    )
  }

  return answer ? normalizeString(parsePlainAnswer(answer)) : undefined
}

function getRespondentEmail(answer?: Answer) {
  const contactInfo = getContactInfoValue(answer)

  if (contactInfo) {
    return normalizeString(contactInfo.email)
  }

  return answer ? normalizeString(parsePlainAnswer(answer)) : undefined
}

function getRespondentPhone(answer?: Answer) {
  const contactInfo = getContactInfoValue(answer)

  if (contactInfo) {
    return normalizeString(contactInfo.phoneNumber)
  }

  return answer ? normalizeString(parsePlainAnswer(answer)) : undefined
}

function resolveScoreVariable(
  form: LeadAwareForm,
  submission: LeadAwareSubmission
): Variable | undefined {
  const configuredId = form.settings?.leadScoreVariableId

  if (helper.isValid(configuredId)) {
    return submission.variables?.find(variable => variable.id === configuredId)
  }

  const scoreVariables = (submission.variables || []).filter(
    variable => variable.kind === 'number' && /score/i.test(variable.name)
  )

  if (scoreVariables.length === 1) {
    return scoreVariables[0]
  }

  const numericVariables = (submission.variables || []).filter(variable => variable.kind === 'number')

  if (numericVariables.length === 1) {
    return numericVariables[0]
  }

  const configuredFormVariable = (form.variables || []).find(
    variable => variable.kind === 'number' && /score/i.test(variable.name)
  )

  if (configuredFormVariable) {
    return submission.variables?.find(variable => variable.id === configuredFormVariable.id)
  }

  return undefined
}

function flattenFormFields(fields?: FormField[]): FormField[] {
  if (!helper.isValidArray(fields)) {
    return []
  }

  const flattened: FormField[] = []

  fields.forEach(field => {
    flattened.push(field)

    if (field.kind === FieldKindEnum.GROUP && helper.isValidArray(field.properties?.fields)) {
      flattened.push(...flattenFormFields(field.properties.fields as FormField[]))
    }
  })

  return flattened
}

function getOrderedQuestionFields(fields?: FormField[]) {
  return flattenFormFields(fields).filter(field => !NON_QUESTION_FIELD_KINDS.includes(field.kind))
}

function buildLeadAnswerItems(fields: FormField[] | undefined, answers: Answer[]): LeadAnswerItem[] {
  const answersById = new Map<string, Answer>()
  const usedQuestions: Record<string, true> = {}

  answers.forEach(answer => {
    if (!answersById.has(answer.id)) {
      answersById.set(answer.id, answer)
    }
  })

  return getOrderedQuestionFields(fields).map((field, index) => {
    const answer = answersById.get(field.id)
    const question = makeUniqueKey(usedQuestions, getFieldTitle(field), `Question ${index + 1}`)

    usedQuestions[question] = true

    return {
      fieldId: field.id,
      question,
      answer: answer ? normalizeString(parsePlainAnswer(answer)) || '' : ''
    }
  })
}

function getSelectedChoiceIds(value: unknown): string[] {
  if (helper.isObject(value) && Object.prototype.hasOwnProperty.call(value, 'value')) {
    return getSelectedChoiceIds((value as { value?: unknown }).value)
  }

  if (helper.isArray(value)) {
    return value
      .map(entry => normalizeString(entry))
      .filter((entry): entry is string => helper.isValid(entry))
  }

  const normalized = normalizeString(value)
  return normalized ? [normalized] : []
}

function hasAnswerValue(answer: Answer): boolean {
  if (helper.isValid(normalizeString(parsePlainAnswer(answer)))) {
    return true
  }

  if (helper.isArray(answer.value)) {
    return answer.value.length > 0
  }

  if (helper.isObject(answer.value)) {
    return Object.values(answer.value as Record<string, unknown>).some(value => {
      if (helper.isArray(value)) {
        return value.length > 0
      }

      return helper.isValid(normalizeString(value)) || helper.isBool(value)
    })
  }

  return !helper.isNil(answer.value)
}

function getAnswerChoiceDefinitions(
  answer: Answer,
  fieldMap?: Map<string, FormField>
): ScoredChoiceLike[] | undefined {
  if (helper.isValidArray(answer.properties?.choices)) {
    return answer.properties.choices as ScoredChoiceLike[]
  }

  const fieldChoices = fieldMap?.get(answer.id)?.properties?.choices

  if (helper.isValidArray(fieldChoices)) {
    return fieldChoices as ScoredChoiceLike[]
  }

  return undefined
}

function getAnswerScore(answer: Answer, fieldMap?: Map<string, FormField>): number | undefined {
  if (!hasAnswerValue(answer)) {
    return undefined
  }

  const choices = getAnswerChoiceDefinitions(answer, fieldMap)

  if (CHOICE_FIELD_KINDS.includes(answer.kind) && helper.isValidArray(choices)) {
    const selectedChoiceIds = getSelectedChoiceIds(answer.value)

    if (selectedChoiceIds.length > 0) {
      const choiceScore = choices
        .filter(choice => selectedChoiceIds.includes(choice.id))
        .reduce((total, choice) => {
          const score = normalizeNumber(choice.score)
          return helper.isNumber(score) ? total + score : total
        }, 0)

      return choiceScore
    }
  }

  return normalizeNumber(answer.properties?.score) ?? normalizeNumber(fieldMap?.get(answer.id)?.properties?.score)
}

function deriveLeadScoreFromAnswers(
  answers: Answer[],
  fieldMap?: Map<string, FormField>
): number | undefined {
  let totalScore = 0
  let hasScoredAnswer = false

  answers.forEach(answer => {
    const score = getAnswerScore(answer, fieldMap)

    if (helper.isNumber(score)) {
      totalScore += score
      hasScoredAnswer = true
    }
  })

  return hasScoredAnswer ? totalScore : undefined
}

export function hasZeroScoreAnswer(
  answers: Answer[],
  fieldMap?: Map<string, FormField>
): boolean {
  return answers.some(answer => {
    if (!hasAnswerValue(answer)) {
      return false
    }

    const choices = getAnswerChoiceDefinitions(answer, fieldMap)

    if (CHOICE_FIELD_KINDS.includes(answer.kind) && helper.isValidArray(choices)) {
      const selectedChoiceIds = getSelectedChoiceIds(answer.value)

      if (selectedChoiceIds.length > 0) {
        return choices.some(choice => {
          return selectedChoiceIds.includes(choice.id) && normalizeNumber(choice.score) === 0
        })
      }
    }

    return (normalizeNumber(answer.properties?.score) ??
      normalizeNumber(fieldMap?.get(answer.id)?.properties?.score)) === 0
  })
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function interpolateLeadTemplate(
  template: string | undefined,
  values: Record<string, string | number | undefined>
): string {
  if (!helper.isValid(template)) {
    return ''
  }

  let result = template!

  Object.entries(values).forEach(([key, value]) => {
    const replacement = helper.isNil(value) ? '' : String(value)
    const pattern = new RegExp(`{{\\s*${escapeRegex(key)}\\s*}}|{${escapeRegex(key)}}`, 'g')
    result = result.replace(pattern, replacement)
  })

  return result
}

export function renderLeadTemplateHtml(
  template: string | undefined,
  values: Record<string, string | number | undefined>
): string {
  return escapeHtml(interpolateLeadTemplate(template, values)).replace(/\r?\n/g, '<br />')
}

export function buildLeadTemplateValues(
  payload: LeadCapturePayload,
  extras?: Record<string, string | number | undefined>
) {
  const values: Record<string, string | number | undefined> = {
    clientName: payload.clientName,
    formId: payload.formId,
    formName: payload.formName,
    quizName: payload.formName,
    projectId: payload.projectId,
    projectName: payload.projectName,
    leadId: payload.submissionId,
    submissionId: payload.submissionId,
    userId: payload.userId,
    userIdSource: payload.userIdSource,
    submittedAt: payload.submittedAtIso,
    respondentName: payload.respondentName,
    respondentEmail: payload.respondentEmail,
    respondentPhone: payload.respondentPhone,
    trafficSource: payload.trafficSource,
    leadScore: helper.isNil(payload.leadScore) ? undefined : String(payload.leadScore),
    leadLevel: payload.leadLevel,
    leadResult: payload.hasZeroScoreAnswer ? 'negative' : 'standard',
    leadQuality: payload.leadQuality,
    leadPriority: payload.leadPriority,
    leadScoreVariableName: payload.leadScoreVariableName,
    answers: payload.answersPlain,
    reportingTimezone: payload.reportingTimezone
  }

  Object.entries(payload.answersByTitle).forEach(([key, value]) => {
    values[`answer.${key}`] = value
  })

  Object.entries(payload.hiddenFieldsByName).forEach(([key, value]) => {
    values[`hidden.${key}`] = value
  })

  Object.entries(payload.variablesByName).forEach(([key, value]) => {
    values[`variable.${key}`] = value
  })

  return {
    ...values,
    ...extras
  }
}

export function buildLeadCapturePayload(
  form: LeadAwareForm,
  submission: LeadAwareSubmission,
  team?: LeadAwareTeam,
  project?: LeadAwareProject
): LeadCapturePayload {
  const settings = (form.settings || {}) as LeadFlowSettings
  const fieldMap = new Map(flattenFormFields(form.fields).map(field => [field.id, field]))
  const hiddenFieldMap = new Map((form.hiddenFields || []).map(field => [field.id, field]))
  const answerItems = buildLeadAnswerItems(form.fields, submission.answers)
  const answersByTitle: Record<string, string> = {}
  const hiddenFieldsByName: Record<string, string> = {}
  const variablesByName: Record<string, string | number> = {}

  submission.answers.forEach((answer, index) => {
    const field = fieldMap.get(answer.id)
    const key = makeUniqueKey(
      answersByTitle,
      getFieldTitle(field, normalizeString((answer as any).title) || answer.id),
      `Question ${index + 1}`
    )
    const value = normalizeString(parsePlainAnswer(answer)) || ''

    answersByTitle[key] = value
  })

  ;(submission.hiddenFields || []).forEach(hiddenField => {
    const key = makeUniqueKey(
      hiddenFieldsByName,
      hiddenFieldMap.get(hiddenField.id)?.name || hiddenField.id,
      hiddenField.id
    )
    hiddenFieldsByName[key] = normalizeString(hiddenField.value) || ''
  })

  ;(submission.variables || []).forEach(variable => {
    const key = makeUniqueKey(variablesByName, variable.name || variable.id, variable.id)

    if (typeof variable.value === 'number' || typeof variable.value === 'string') {
      variablesByName[key] = variable.value
    }
  })

  const respondentNameAnswer = resolveConfiguredAnswer(settings, submission.answers, 'respondentNameFieldId', [
    FieldKindEnum.CONTACT_INFO,
    FieldKindEnum.FULL_NAME,
    FieldKindEnum.SHORT_TEXT
  ])
  const respondentEmailAnswer = resolveConfiguredAnswer(settings, submission.answers, 'respondentEmailFieldId', [
    FieldKindEnum.CONTACT_INFO,
    FieldKindEnum.EMAIL
  ])
  const respondentPhoneAnswer = resolveConfiguredAnswer(settings, submission.answers, 'respondentPhoneFieldId', [
    FieldKindEnum.CONTACT_INFO,
    FieldKindEnum.PHONE_NUMBER
  ])
  const scoreVariable = resolveScoreVariable(form, submission)
  const variableLeadScore = normalizeNumber(scoreVariable?.value)
  const derivedLeadScore = helper.isNumber(variableLeadScore)
    ? undefined
    : deriveLeadScoreFromAnswers(submission.answers, fieldMap)
  const leadScore = helper.isNumber(variableLeadScore) ? variableLeadScore : derivedLeadScore
  const leadMediumThreshold = normalizeNumber(settings.leadMediumThreshold) ?? 50
  const leadHighThreshold = normalizeNumber(settings.leadHighThreshold) ?? 80
  const leadLevel = getLeadLevel(leadScore, leadMediumThreshold, leadHighThreshold)
  const negativeLead = hasZeroScoreAnswer(submission.answers, fieldMap)
  const respondentName = getRespondentName(respondentNameAnswer)
  const respondentEmail = getRespondentEmail(respondentEmailAnswer)
  const respondentPhone = getRespondentPhone(respondentPhoneAnswer)
  const userIdentity = buildLeadUserIdentity({
    respondentName,
    respondentEmail,
    respondentPhone,
    submissionId: submission.id
  })
  const leadQuality = getLeadLabel(leadScore, leadMediumThreshold, leadHighThreshold, {
    high: normalizeString(settings.leadQualityHighLabel) || DEFAULT_LEAD_QUALITY_LABELS.high,
    medium: normalizeString(settings.leadQualityMediumLabel) || DEFAULT_LEAD_QUALITY_LABELS.medium,
    low: normalizeString(settings.leadQualityLowLabel) || DEFAULT_LEAD_QUALITY_LABELS.low
  })
  const leadPriority = getLeadLabel(leadScore, leadMediumThreshold, leadHighThreshold, {
    high: normalizeString(settings.leadPriorityHighLabel) || DEFAULT_LEAD_PRIORITY_LABELS.high,
    medium: normalizeString(settings.leadPriorityMediumLabel) || DEFAULT_LEAD_PRIORITY_LABELS.medium,
    low: normalizeString(settings.leadPriorityLowLabel) || DEFAULT_LEAD_PRIORITY_LABELS.low
  })
  const answersPlain = submission.answers
    .map(answer => {
      const field = fieldMap.get(answer.id)
      const title = getFieldTitle(field, normalizeString((answer as any).title))
      const value = normalizeString(parsePlainAnswer(answer)) || ''

      return `${title}\n${value}`
    })
    .join('\n\n')

  return {
    clientName: normalizeString(team?.clientName),
    formId: getRecordIdentifier(form) || '',
    formName: form.name,
    projectId: normalizeString(form.projectId) || getRecordIdentifier(project),
    projectName: normalizeString(project?.name),
    submissionId: getRecordIdentifier(submission) || '',
    userId: userIdentity.userId,
    userIdSource: userIdentity.userIdSource,
    submittedAt: submission.endAt || 0,
    submittedAtIso: new Date((submission.endAt || 0) * 1000).toISOString(),
    respondentName,
    respondentEmail,
    respondentPhone,
    leadScore,
    leadScoreVariableId: scoreVariable?.id,
    leadScoreVariableName: scoreVariable?.name || (helper.isNumber(derivedLeadScore) ? DERIVED_LEAD_SCORE_SOURCE : undefined),
    leadLevel,
    hasZeroScoreAnswer: negativeLead,
    leadQuality,
    leadPriority,
    answerItems,
    answersByTitle,
    hiddenFieldsByName,
    variablesByName,
    answersPlain,
    answersHtml: answersToHtml(submission.answers),
    reportingTimezone: normalizeString(project?.reportingTimezone || team?.reportingTimezone)
  }
}

export function buildTestLeadCapturePayload(
  form: LeadAwareForm,
  team?: LeadAwareTeam,
  sampleLeadLevel: LeadLevel = 'high',
  sampleIndex = 0
): LeadCapturePayload {
  const settings = (form.settings || {}) as LeadFlowSettings
  const answersByTitle: Record<string, string> = {}
  const answerItems: LeadAnswerItem[] = []
  const hiddenFieldsByName: Record<string, string> = {}
  const variablesByName: Record<string, string | number> = {}
  const submittedAt = Math.floor(Date.now() / 1000)
  const leadMediumThreshold = normalizeNumber(settings.leadMediumThreshold) ?? 50
  const leadHighThreshold = normalizeNumber(settings.leadHighThreshold) ?? 80
  const persona = TEST_LEAD_PERSONAS[sampleLeadLevel]
  const leadScore = getTestLeadScore(sampleLeadLevel, leadMediumThreshold, leadHighThreshold)
  const submissionId = `test-${sampleLeadLevel}-${submittedAt}-${sampleIndex + 1}`
  const respondentName = buildTaggedName(persona.respondentName, sampleIndex)
  const respondentEmail = buildTaggedEmail(persona.respondentEmail, sampleIndex)
  const respondentPhone = persona.respondentPhone
  const trafficSource = TEST_TRAFFIC_SOURCES[sampleIndex % TEST_TRAFFIC_SOURCES.length]

  getOrderedQuestionFields(form.fields).forEach((field, index) => {
    const question = makeUniqueKey(answersByTitle, getFieldTitle(field), `Question ${index + 1}`)
    const answer = getSampleAnswerValue(field, index, sampleLeadLevel)

    answersByTitle[question] = answer
    answerItems.push({
      fieldId: field.id,
      question,
      answer
    })
  })

  ;(form.hiddenFields || []).forEach(hiddenField => {
    const key = makeUniqueKey(hiddenFieldsByName, hiddenField.name || hiddenField.id, hiddenField.id)
    hiddenFieldsByName[key] = `test-${toTokenSlug(key)}`
  })

  const scoreVariable =
    (helper.isValid(settings.leadScoreVariableId)
      ? (form.variables || []).find(variable => variable.id === settings.leadScoreVariableId)
      : undefined) ||
    (form.variables || []).find(variable => variable.kind === 'number' && /score/i.test(variable.name)) ||
    (form.variables || []).find(variable => variable.kind === 'number')

  ;(form.variables || []).forEach((variable, index) => {
    const key = makeUniqueKey(variablesByName, variable.name || variable.id, variable.id || `Variable ${index + 1}`)

    if (scoreVariable && variable.id === scoreVariable.id) {
      variablesByName[key] = leadScore
    } else if (typeof variable.value === 'number' || typeof variable.value === 'string') {
      variablesByName[key] = variable.value
    } else {
      variablesByName[key] = `test-${toTokenSlug(variable.name || variable.id || `variable-${index + 1}`)}`
    }
  })

  const resolvedLeadLevel = getLeadLevel(leadScore, leadMediumThreshold, leadHighThreshold)
  const leadQuality = getLeadLabel(leadScore, leadMediumThreshold, leadHighThreshold, {
    high: normalizeString(settings.leadQualityHighLabel) || DEFAULT_LEAD_QUALITY_LABELS.high,
    medium: normalizeString(settings.leadQualityMediumLabel) || DEFAULT_LEAD_QUALITY_LABELS.medium,
    low: normalizeString(settings.leadQualityLowLabel) || DEFAULT_LEAD_QUALITY_LABELS.low
  })
  const leadPriority = getLeadLabel(leadScore, leadMediumThreshold, leadHighThreshold, {
    high: normalizeString(settings.leadPriorityHighLabel) || DEFAULT_LEAD_PRIORITY_LABELS.high,
    medium: normalizeString(settings.leadPriorityMediumLabel) || DEFAULT_LEAD_PRIORITY_LABELS.medium,
    low: normalizeString(settings.leadPriorityLowLabel) || DEFAULT_LEAD_PRIORITY_LABELS.low
  })
  const userIdentity = buildLeadUserIdentity({
    respondentName,
    respondentEmail,
    respondentPhone,
    submissionId
  })
  const answersPlain = Object.entries(answersByTitle)
    .map(([title, value]) => `${title}\n${value}`)
    .join('\n\n')

  return {
    clientName: normalizeString(team?.clientName),
    formId: getRecordIdentifier(form) || '',
    formName: form.name,
    projectId: form.projectId,
    submissionId,
    userId: userIdentity.userId,
    userIdSource: userIdentity.userIdSource,
    submittedAt,
    submittedAtIso: new Date(submittedAt * 1000).toISOString(),
    respondentName,
    respondentEmail,
    respondentPhone,
    trafficSource,
    leadScore,
    leadScoreVariableId: scoreVariable?.id,
    leadScoreVariableName: scoreVariable?.name,
    leadLevel: resolvedLeadLevel,
    hasZeroScoreAnswer: false,
    leadQuality,
    leadPriority,
    answerItems,
    answersByTitle,
    hiddenFieldsByName,
    variablesByName,
    answersPlain,
    answersHtml: answersPlain.replace(/\n/g, '<br />'),
    reportingTimezone: normalizeString(team?.reportingTimezone)
  }
}

export function buildTestLeadCapturePayloads(
  form: LeadAwareForm,
  team?: LeadAwareTeam,
  sampleCount = TEST_LEAD_LEVELS.length
): LeadCapturePayload[] {
  return Array.from({ length: Math.max(1, sampleCount) }, (_, index) => {
    const level = TEST_LEAD_LEVELS[index % TEST_LEAD_LEVELS.length]

    return buildTestLeadCapturePayload(form, team, level, index)
  })
}

export function resolveRespondentNotificationTemplates(
  payload: Pick<LeadCapturePayload, 'hasZeroScoreAnswer'>,
  settings: {
    subject?: string
    message?: string
    negativeSubject?: string
    negativeMessage?: string
  }
) {
  const isNegative = Boolean(payload.hasZeroScoreAnswer)

  if (isNegative) {
    return {
      isNegative,
      subjectTemplate:
        normalizeString(settings.negativeSubject) ||
        DEFAULT_NEGATIVE_RESPONDENT_NOTIFICATION_SUBJECT,
      messageTemplate:
        normalizeString(settings.negativeMessage) ||
        DEFAULT_NEGATIVE_RESPONDENT_NOTIFICATION_MESSAGE
    }
  }

  return {
    isNegative,
    subjectTemplate:
      normalizeString(settings.subject) || DEFAULT_RESPONDENT_NOTIFICATION_SUBJECT,
    messageTemplate:
      normalizeString(settings.message) || DEFAULT_RESPONDENT_NOTIFICATION_MESSAGE
  }
}

export function buildLeadSheetRow(payload: LeadCapturePayload) {
  const row: Record<string, string | number | boolean> = {
    'Lead Contacted': false,
    'Lead Contacted At': '',
    'Traffic Source': payload.trafficSource || '',
    'Respondent Name': payload.respondentName || '',
    'Respondent Email': payload.respondentEmail || '',
    'Respondent Phone': payload.respondentPhone || '',
    'Project Name': payload.projectName || '',
    'Quiz Name': payload.formName,
    'Submitted At': formatUtcDateTime(payload.submittedAtIso),
    'Lead Score': helper.isNil(payload.leadScore) ? '' : payload.leadScore,
    'Lead Level': payload.leadLevel || '',
    'Lead ID': payload.submissionId,
    'View Answers': ''
  }

  return row
}

export function buildLeadAnswerSheetRows(payload: LeadCapturePayload): LeadAnswerSheetRow[] {
  const submittedAt = formatUtcDateTime(payload.submittedAtIso)
  const answerItems = helper.isValidArray(payload.answerItems)
    ? payload.answerItems
    : Object.entries(payload.answersByTitle).map(([question, answer], index) => ({
        fieldId: String(index + 1),
        question,
        answer
      }))

  const row: LeadAnswerSheetRow = {
    'Lead ID': payload.submissionId,
    'Quiz Name': payload.formName,
    'Submitted At': submittedAt
  }

  answerItems.forEach(item => {
    row[item.question] = item.answer
  })

  return [row]
}
