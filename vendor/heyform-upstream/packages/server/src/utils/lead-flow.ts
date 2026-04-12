import { answersToHtml, htmlUtils, parsePlainAnswer } from '@heyform-inc/answer-utils'
import {
  Answer,
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
  enableOperatorNotification?: boolean
  operatorNotificationEmails?: string[]
  operatorNotificationSubject?: string
  operatorNotificationMessage?: string
}

export interface LeadCapturePayload {
  clientName?: string
  formId: string
  formName: string
  projectId?: string
  projectName?: string
  submissionId: string
  submittedAt: number
  submittedAtIso: string
  respondentName?: string
  respondentEmail?: string
  respondentPhone?: string
  leadScore?: number
  leadScoreVariableId?: string
  leadScoreVariableName?: string
  leadLevel?: 'high' | 'medium' | 'low'
  leadQuality?: string
  leadPriority?: string
  answersByTitle: Record<string, string>
  hiddenFieldsByName: Record<string, string>
  variablesByName: Record<string, string | number>
  answersPlain: string
  answersHtml: string
  reportingTimezone?: string
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

function getSampleAnswerValue(field: FormField, index: number): string {
  switch (field.kind) {
    case FieldKindEnum.FULL_NAME:
      return 'Test Lead'
    case FieldKindEnum.EMAIL:
      return 'test.lead@example.com'
    case FieldKindEnum.PHONE_NUMBER:
      return '+1 555 010 2024'
    case FieldKindEnum.URL:
      return 'https://example.com/test-lead'
    case FieldKindEnum.DATE:
      return '2026-01-15'
    case FieldKindEnum.DATE_RANGE:
      return '2026-01-15 to 2026-01-20'
    case FieldKindEnum.NUMBER:
    case FieldKindEnum.RATING:
    case FieldKindEnum.OPINION_SCALE:
      return String(index + 4)
    case FieldKindEnum.YES_NO:
    case FieldKindEnum.LEGAL_TERMS:
      return 'Yes'
    case FieldKindEnum.MULTIPLE_CHOICE:
    case FieldKindEnum.PICTURE_CHOICE:
      return 'Option A'
    case FieldKindEnum.ADDRESS:
      return '123 Test Street, Example City'
    case FieldKindEnum.COUNTRY:
      return 'United States'
    case FieldKindEnum.FILE_UPLOAD:
      return 'test-upload.pdf'
    case FieldKindEnum.SIGNATURE:
      return 'Signed by Test Lead'
    case FieldKindEnum.PAYMENT:
      return '$149.00'
    case FieldKindEnum.INPUT_TABLE:
      return 'Sample row data'
    default:
      return `Sample answer ${index + 1}`
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
    projectId: payload.projectId,
    projectName: payload.projectName,
    submissionId: payload.submissionId,
    submittedAt: payload.submittedAtIso,
    respondentName: payload.respondentName,
    respondentEmail: payload.respondentEmail,
    respondentPhone: payload.respondentPhone,
    leadScore: helper.isNil(payload.leadScore) ? undefined : String(payload.leadScore),
    leadLevel: payload.leadLevel,
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
  const fieldMap = new Map((form.fields || []).map(field => [field.id, field]))
  const hiddenFieldMap = new Map((form.hiddenFields || []).map(field => [field.id, field]))
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
    FieldKindEnum.FULL_NAME,
    FieldKindEnum.SHORT_TEXT
  ])
  const respondentEmailAnswer = resolveConfiguredAnswer(settings, submission.answers, 'respondentEmailFieldId', [
    FieldKindEnum.EMAIL
  ])
  const respondentPhoneAnswer = resolveConfiguredAnswer(settings, submission.answers, 'respondentPhoneFieldId', [
    FieldKindEnum.PHONE_NUMBER
  ])
  const scoreVariable = resolveScoreVariable(form, submission)
  const leadScore = normalizeNumber(scoreVariable?.value)
  const leadMediumThreshold = normalizeNumber(settings.leadMediumThreshold) ?? 50
  const leadHighThreshold = normalizeNumber(settings.leadHighThreshold) ?? 80
  const leadLevel = getLeadLevel(leadScore, leadMediumThreshold, leadHighThreshold)
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
    formId: form.id || '',
    formName: form.name,
    projectId: form.projectId || project?.id,
    projectName: normalizeString(project?.name),
    submissionId: submission.id || '',
    submittedAt: submission.endAt || 0,
    submittedAtIso: new Date((submission.endAt || 0) * 1000).toISOString(),
    respondentName: respondentNameAnswer ? normalizeString(parsePlainAnswer(respondentNameAnswer)) : undefined,
    respondentEmail: respondentEmailAnswer
      ? normalizeString(parsePlainAnswer(respondentEmailAnswer))
      : undefined,
    respondentPhone: respondentPhoneAnswer
      ? normalizeString(parsePlainAnswer(respondentPhoneAnswer))
      : undefined,
    leadScore,
    leadScoreVariableId: scoreVariable?.id,
    leadScoreVariableName: scoreVariable?.name,
    leadLevel,
    leadQuality,
    leadPriority,
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
  team?: LeadAwareTeam
): LeadCapturePayload {
  const settings = (form.settings || {}) as LeadFlowSettings
  const answersByTitle: Record<string, string> = {}
  const hiddenFieldsByName: Record<string, string> = {}
  const variablesByName: Record<string, string | number> = {}
  const submittedAt = Math.floor(Date.now() / 1000)
  const leadMediumThreshold = normalizeNumber(settings.leadMediumThreshold) ?? 50
  const leadHighThreshold = normalizeNumber(settings.leadHighThreshold) ?? 80
  const leadScore = leadHighThreshold + 5

  ;(form.fields || [])
    .filter(field => !NON_QUESTION_FIELD_KINDS.includes(field.kind))
    .forEach((field, index) => {
      const key = makeUniqueKey(answersByTitle, getFieldTitle(field), `Question ${index + 1}`)
      answersByTitle[key] = getSampleAnswerValue(field, index)
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

  const leadLevel = getLeadLevel(leadScore, leadMediumThreshold, leadHighThreshold)
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
  const answersPlain = Object.entries(answersByTitle)
    .map(([title, value]) => `${title}\n${value}`)
    .join('\n\n')

  return {
    clientName: normalizeString(team?.clientName),
    formId: form.id || '',
    formName: form.name,
    submissionId: `test-${submittedAt}`,
    submittedAt,
    submittedAtIso: new Date(submittedAt * 1000).toISOString(),
    respondentName: 'Test Lead',
    respondentEmail: 'test.lead@example.com',
    respondentPhone: '+1 555 010 2024',
    leadScore,
    leadScoreVariableId: scoreVariable?.id,
    leadScoreVariableName: scoreVariable?.name,
    leadLevel,
    leadQuality,
    leadPriority,
    answersByTitle,
    hiddenFieldsByName,
    variablesByName,
    answersPlain,
    answersHtml: answersPlain.replace(/\n/g, '<br />'),
    reportingTimezone: normalizeString(team?.reportingTimezone)
  }
}

export function buildLeadSheetRow(payload: LeadCapturePayload) {
  const row: Record<string, string | number> = {
    'Submission ID': payload.submissionId,
    'Form ID': payload.formId,
    'Form Name': payload.formName,
    'Submitted At (UTC)': payload.submittedAtIso,
    'Respondent Name': payload.respondentName || '',
    'Respondent Email': payload.respondentEmail || '',
    'Respondent Phone': payload.respondentPhone || '',
    'Lead Score': helper.isNil(payload.leadScore) ? '' : payload.leadScore,
    'Lead Level': payload.leadLevel || '',
    'Lead Quality': payload.leadQuality || '',
    'Lead Priority': payload.leadPriority || '',
    'Lead Score Source': payload.leadScoreVariableName || '',
    'Answers Summary': payload.answersPlain,
    'Hidden Fields JSON': JSON.stringify(payload.hiddenFieldsByName),
    'Variables JSON': JSON.stringify(payload.variablesByName)
  }

  if (helper.isValid(payload.clientName)) {
    row['Client Name'] = payload.clientName!
  }

  if (helper.isValid(payload.projectId)) {
    row['Project ID'] = payload.projectId!
  }

  if (helper.isValid(payload.projectName)) {
    row['Project Name'] = payload.projectName!
  }

  Object.entries(payload.answersByTitle).forEach(([key, value]) => {
    row[key] = value
  })

  Object.entries(payload.hiddenFieldsByName).forEach(([key, value]) => {
    row[`Hidden: ${key}`] = value
  })

  Object.entries(payload.variablesByName).forEach(([key, value]) => {
    row[`Variable: ${key}`] = value
  })

  return row
}
