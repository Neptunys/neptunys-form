import { google } from 'googleapis'
import * as mongoose from 'mongoose'

import { helper } from '@heyform-inc/utils'

import {
  buildLeadAnswerSheetRows,
  buildLeadCapturePayload,
  buildLeadSheetRow,
  buildLeadTemplateValues,
  buildTestLeadCapturePayloads,
  interpolateLeadTemplate,
  LeadAnswerSheetRow,
  LeadCapturePayload
} from '../utils'
import {
  normalizeTrafficSourceLabel,
  resolveTrafficSourceLabel,
  TrafficSourceRecord
} from '../utils/traffic-source'
import { FormOpenHistoryModel } from '../model'

const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const DEFAULT_SHEET_NAME = 'Leads'
const DEFAULT_ANSWERS_SHEET_NAME = 'Lead Answers'
const DEFAULT_COLUMN_WIDTH = 150
const HEADER_ROW_PIXEL_SIZE = 42
const DATA_ROW_PIXEL_SIZE = 32
const LEAD_CONTACTED_HEADER = 'Lead Contacted'
const LEAD_CONTACTED_AT_HEADER = 'Lead Contacted At'
const TRAFFIC_SOURCE_HEADER = 'Traffic Source'
const LEAD_ID_HEADER = 'Lead ID'
const VIEW_ANSWERS_HEADER = 'View Answers'
const QUIZ_NAME_HEADER = 'Quiz Name'
const LEAD_SCORE_HEADER = 'Lead Score'
const QUESTION_ORDER_HEADER = 'Question Order'
const SUBMITTED_AT_HEADER = 'Submitted At'
const LEGACY_QUESTION_HEADER = 'Question'
const LEGACY_ANSWER_HEADER = 'Answer'
const HEADER_BACKGROUND_COLOR = {
  red: 0.11,
  green: 0.15,
  blue: 0.22
}
const HEADER_TEXT_COLOR = {
  red: 1,
  green: 1,
  blue: 1
}
const DEFAULT_TEXT_COLOR = {
  red: 0.13,
  green: 0.13,
  blue: 0.13
}
const BASE_ROW_BACKGROUND_COLOR = {
  red: 1,
  green: 1,
  blue: 1
}
const LEAD_LEVEL_ROW_FORMATS = {
  high: {
    backgroundColor: {
      red: 0.9,
      green: 0.97,
      blue: 0.91
    },
    textColor: {
      red: 0.11,
      green: 0.31,
      blue: 0.12
    }
  },
  medium: {
    backgroundColor: {
      red: 0.99,
      green: 0.96,
      blue: 0.84
    },
    textColor: {
      red: 0.47,
      green: 0.35,
      blue: 0.06
    }
  },
  low: {
    backgroundColor: {
      red: 0.99,
      green: 0.9,
      blue: 0.9
    },
    textColor: {
      red: 0.56,
      green: 0.12,
      blue: 0.12
    }
  }
} satisfies Record<LeadLevel, { backgroundColor: Record<string, number>; textColor: Record<string, number> }>
const BASE_LEAD_SHEET_HEADERS = [
  LEAD_CONTACTED_HEADER,
  LEAD_CONTACTED_AT_HEADER,
  TRAFFIC_SOURCE_HEADER,
  'Respondent Name',
  'Respondent Email',
  'Respondent Phone',
  'Project Name',
  QUIZ_NAME_HEADER,
  SUBMITTED_AT_HEADER,
  LEAD_SCORE_HEADER,
  'Lead Level',
  LEAD_ID_HEADER,
  VIEW_ANSWERS_HEADER
]
const BASE_ANSWERS_SHEET_HEADERS = [LEAD_ID_HEADER, QUIZ_NAME_HEADER, SUBMITTED_AT_HEADER]
const LEGACY_ANSWERS_SHEET_HEADERS = [
  LEAD_ID_HEADER,
  QUIZ_NAME_HEADER,
  SUBMITTED_AT_HEADER,
  QUESTION_ORDER_HEADER,
  LEGACY_QUESTION_HEADER,
  LEGACY_ANSWER_HEADER
]
const COLUMN_WIDTH_OVERRIDES: Record<string, number> = {
  'Lead Contacted': 128,
  'Lead Contacted At': 180,
  'Traffic Source': 150,
  'Lead ID': 170,
  'View Answers': 140,
  'Quiz Name': 220,
  'Project Name': 200,
  'Submitted At': 185,
  'Respondent Name': 180,
  'Respondent Email': 240,
  'Respondent Phone': 170,
  'Lead Score': 100,
  'Lead Level': 110,
  'Question Order': 120,
  Question: 240,
  Answer: 360
}
type GoogleSheetsConfig = Record<string, any>
type GoogleSheetsRow = Record<string, string | number | boolean>
type LeadLevel = 'high' | 'medium' | 'low'
type WriteMode = 'append' | 'upsert'
type WorksheetInfo = {
  sheetId: number
}
function getSheetRange(sheetName: string, range: string) {
  return `'${sheetName.replace(/'/g, "''")}'!${range}`
}

function escapeFormulaText(value: string) {
  return value.replace(/"/g, '""')
}

function parseUpdatedRangeRowNumbers(updatedRange: string | undefined, expectedCount: number) {
  const match = updatedRange?.match(/![A-Z]+(\d+)(?::[A-Z]+(\d+))?$/i)

  if (!match) {
    throw new Error('Google Sheets append response did not include an updated row range')
  }

  const startRow = Number(match[1])
  const endRow = Number(match[2] || match[1])

  if (!Number.isInteger(startRow) || !Number.isInteger(endRow) || endRow < startRow) {
    throw new Error(`Google Sheets append response returned an invalid row range: ${updatedRange}`)
  }

  const rowNumbers = Array.from({ length: endRow - startRow + 1 }, (_, index) => startRow + index)

  if (rowNumbers.length !== expectedCount) {
    throw new Error(
      `Google Sheets append response row count ${rowNumbers.length} did not match expected row count ${expectedCount}`
    )
  }

  return rowNumbers
}

function buildViewAnswersFormula(
  spreadsheetId: string,
  answersSheetId: number,
  answersSheetName: string,
  leadId: string
) {
  const escapedSheetName = answersSheetName.replace(/'/g, "''")
  const escapedLeadId = escapeFormulaText(leadId)

  return `=IFERROR(HYPERLINK("https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${answersSheetId}&range=A"&MATCH("${escapedLeadId}",'${escapedSheetName}'!A:A,0),"Check Answers"),"")`
}

function normalizeText(value: unknown): string | undefined {
  if (helper.isNil(value)) {
    return undefined
  }

  const normalized = String(value).trim()

  return helper.isValid(normalized) ? normalized : undefined
}

function normalizeLookupKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function findNamedValue(record: Record<string, string | number>, candidateKeys: string[]) {
  const normalizedCandidates = new Set(candidateKeys.map(normalizeLookupKey))

  for (const [key, value] of Object.entries(record)) {
    if (normalizedCandidates.has(normalizeLookupKey(key))) {
      const normalizedValue = normalizeText(value)

      if (normalizedValue) {
        return normalizedValue
      }
    }
  }

  return undefined
}

function getFormOpenHistoryModel() {
  for (const connection of mongoose.connections) {
    const model = connection.models[FormOpenHistoryModel.name] as
      | mongoose.Model<{ source?: TrafficSourceRecord }>
      | undefined

    if (model) {
      return model
    }
  }

  return mongoose.models[FormOpenHistoryModel.name] as
    | mongoose.Model<{ source?: TrafficSourceRecord }>
    | undefined
}

async function findSubmissionTrafficSource(formId: string, sessionId?: string) {
  if (!helper.isValid(sessionId)) {
    return undefined
  }

  const model = getFormOpenHistoryModel()

  if (!model) {
    return undefined
  }

  try {
    const session =
      (await model.findOne({ _id: sessionId, formId }, { source: 1 }).lean()) ||
      (await model.findOne({ _id: sessionId }, { source: 1 }).lean())

    return resolveTrafficSourceLabel(session?.source)
  } catch {
    return undefined
  }
}

async function resolveTrafficSource(
  formId: string,
  submission: { sessionId?: string } | undefined,
  payload: LeadCapturePayload
) {
  return (
    normalizeTrafficSourceLabel(payload.trafficSource) ||
    (await findSubmissionTrafficSource(formId, submission?.sessionId)) ||
    normalizeTrafficSourceLabel(
      findNamedValue(payload.hiddenFieldsByName, ['utm_source', 'utm_medium', 'source', 'traffic_source', 'channel'])
    ) ||
    normalizeTrafficSourceLabel(
      findNamedValue(payload.variablesByName, ['utm_source', 'utm_medium', 'source', 'traffic_source', 'channel'])
    )
  )
}

function getLevelSuffix(level: LeadLevel) {
  return `${level.charAt(0).toUpperCase()}${level.slice(1)}`
}

function shouldRouteByLeadLevel(config: GoogleSheetsConfig) {
  return Boolean(config.routeByLeadLevel)
}

function getSheetName(config: GoogleSheetsConfig, level?: LeadLevel) {
  if (level) {
    const routedSheetName = normalizeText(config[`sheetName${getLevelSuffix(level)}`])

    if (routedSheetName) {
      return routedSheetName
    }
  }

  return normalizeText(config.sheetName) || DEFAULT_SHEET_NAME
}

function getAnswersSheetName(config: GoogleSheetsConfig) {
  return normalizeText(config.answersSheetName) || DEFAULT_ANSWERS_SHEET_NAME
}

function getSpreadsheetId(config: GoogleSheetsConfig, level?: LeadLevel) {
  const routedSpreadsheetId = level
    ? normalizeText(config[`spreadsheetId${getLevelSuffix(level)}`])
    : undefined
  const spreadsheetId = routedSpreadsheetId || normalizeText(config.spreadsheetId)

  if (!spreadsheetId) {
    throw new Error('Google Sheets spreadsheet ID is required')
  }

  return spreadsheetId
}

function getJwtClient(config: GoogleSheetsConfig) {
  const serviceAccountEmail = normalizeText(config.serviceAccountEmail)

  if (!serviceAccountEmail) {
    throw new Error('Google Sheets service account email is required')
  }

  if (!helper.isValid(config.serviceAccountPrivateKey)) {
    throw new Error('Google Sheets service account private key is required')
  }

  return new google.auth.JWT(
    serviceAccountEmail,
    undefined,
    config.serviceAccountPrivateKey.replace(/\\n/g, '\n'),
    [GOOGLE_SHEETS_SCOPE]
  )
}

function getWriteMode(config: GoogleSheetsConfig): WriteMode {
  return normalizeText(config.writeMode) === 'upsert' ? 'upsert' : 'append'
}

function getTestLeadCount(config: GoogleSheetsConfig) {
  const parsed = Number(config.testLeadCount)

  if (!Number.isFinite(parsed)) {
    return 3
  }

  return Math.max(1, Math.min(50, Math.floor(parsed)))
}

function normalizeRowValue(value: unknown): string | number | boolean {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (helper.isNil(value)) {
    return ''
  }

  return String(value)
}

function parseColumnMapping(config: GoogleSheetsConfig): Record<string, unknown> {
  if (helper.isNil(config.columnMappingJson) || config.columnMappingJson === '') {
    return {}
  }

  if (typeof config.columnMappingJson === 'object' && !Array.isArray(config.columnMappingJson)) {
    return config.columnMappingJson
  }

  if (typeof config.columnMappingJson === 'string') {
    try {
      const parsed = JSON.parse(config.columnMappingJson)

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed
      }
    } catch (error) {
      throw new Error('Google Sheets column mapping JSON must be a valid JSON object')
    }
  }

  throw new Error('Google Sheets column mapping JSON must be an object')
}

function applyColumnMapping(
  row: GoogleSheetsRow,
  payload: LeadCapturePayload,
  config: GoogleSheetsConfig
) {
  const columnMapping = parseColumnMapping(config)

  if (helper.isEmpty(columnMapping)) {
    return row
  }

  const templateValues = buildLeadTemplateValues(payload)
  const mappedRow = {
    ...row
  }

  Object.entries(columnMapping).forEach(([columnName, rawValue]) => {
    const normalizedColumnName = normalizeText(columnName)

    if (!normalizedColumnName) {
      return
    }

    mappedRow[normalizedColumnName] =
      typeof rawValue === 'string'
        ? normalizeRowValue(interpolateLeadTemplate(rawValue, templateValues))
        : normalizeRowValue(rawValue)
  })

  return mappedRow
}

function getColumnLetter(columnNumber: number) {
  let result = ''
  let current = columnNumber

  while (current > 0) {
    const remainder = (current - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    current = Math.floor((current - 1) / 26)
  }

  return result
}

function buildUserEnteredFormat({
  backgroundColor,
  textColor,
  bold,
  horizontalAlignment,
  verticalAlignment,
  wrapStrategy
}: {
  backgroundColor?: Record<string, number>
  textColor?: Record<string, number>
  bold?: boolean
  horizontalAlignment?: 'LEFT' | 'CENTER'
  verticalAlignment?: 'TOP' | 'MIDDLE'
  wrapStrategy?: 'CLIP' | 'WRAP'
}) {
  const textFormat: Record<string, any> = {}

  if (!helper.isNil(bold)) {
    textFormat.bold = bold
  }

  if (textColor) {
    textFormat.foregroundColor = textColor
  }

  const format: Record<string, any> = {}

  if (backgroundColor) {
    format.backgroundColor = backgroundColor
  }

  if (!helper.isEmpty(textFormat)) {
    format.textFormat = textFormat
  }

  if (horizontalAlignment) {
    format.horizontalAlignment = horizontalAlignment
  }

  if (verticalAlignment) {
    format.verticalAlignment = verticalAlignment
  }

  if (wrapStrategy) {
    format.wrapStrategy = wrapStrategy
  }

  return format
}

function getColumnIndex(headers: string[], headerName: string) {
  return headers.indexOf(headerName)
}

function buildDefaultSortSpecs(headers: string[]) {
  const sortSpecs: Array<{ dimensionIndex: number; sortOrder: 'ASCENDING' | 'DESCENDING' }> = []
  const leadScoreColumnIndex = getColumnIndex(headers, LEAD_SCORE_HEADER)
  const submittedAtColumnIndex = getColumnIndex(headers, SUBMITTED_AT_HEADER)
  const questionOrderColumnIndex = getColumnIndex(headers, QUESTION_ORDER_HEADER)

  if (leadScoreColumnIndex >= 0) {
    sortSpecs.push({
      dimensionIndex: leadScoreColumnIndex,
      sortOrder: 'DESCENDING'
    })
  }

  if (submittedAtColumnIndex >= 0) {
    sortSpecs.push({
      dimensionIndex: submittedAtColumnIndex,
      sortOrder: 'DESCENDING'
    })
  }

  if (questionOrderColumnIndex >= 0) {
    sortSpecs.push({
      dimensionIndex: questionOrderColumnIndex,
      sortOrder: 'ASCENDING'
    })
  }

  return sortSpecs
}

function resolveSheetDestination(config: GoogleSheetsConfig, payload: LeadCapturePayload) {
  const routedLevel = shouldRouteByLeadLevel(config) && payload.leadLevel ? payload.leadLevel : undefined

  return {
    level: routedLevel,
    spreadsheetId: getSpreadsheetId(config, routedLevel),
    sheetName: getSheetName(config, routedLevel),
    answersSheetName: getAnswersSheetName(config)
  }
}

function getUpsertMatchColumn(config: GoogleSheetsConfig) {
  const matchColumn = normalizeText(config.upsertMatchColumn)

  if (!matchColumn) {
    throw new Error('Google Sheets upsert match column is required when write mode is upsert')
  }

  return matchColumn
}

function resolveUpsertMatchValue(
  config: GoogleSheetsConfig,
  payload: LeadCapturePayload,
  row: GoogleSheetsRow,
  matchColumn: string
) {
  const template = normalizeText(config.upsertValueTemplate)
  const rawValue = template
    ? interpolateLeadTemplate(template, buildLeadTemplateValues(payload))
    : row[matchColumn]
  const matchValue = normalizeText(rawValue)

  if (!matchValue) {
    throw new Error(`Google Sheets upsert value for column "${matchColumn}" is empty`)
  }

  return matchValue
}

function normalizeHeaders(existingHeaders: string[], nextRow: GoogleSheetsRow) {
  const normalizedHeaders = existingHeaders.filter(helper.isValid)

  Object.keys(nextRow).forEach(key => {
    if (!normalizedHeaders.includes(key)) {
      normalizedHeaders.push(key)
    }
  })

  return normalizedHeaders
}

function buildUniqueHeaderKey(row: GoogleSheetsRow, rawKey: string, fallback: string) {
  const baseKey = normalizeText(rawKey) || fallback
  let nextKey = baseKey
  let index = 2

  while (Object.prototype.hasOwnProperty.call(row, nextKey)) {
    nextKey = `${baseKey} (${index})`
    index += 1
  }

  return nextKey
}

function isLegacyAnswerSheetHeaders(headers: string[]) {
  return LEGACY_ANSWERS_SHEET_HEADERS.every((header, index) => headers[index] === header)
}

function buildAnswerSheetHeaders(existingHeaders: string[], rows: LeadAnswerSheetRow[]) {
  const existingDynamicHeaders = helper.isValidArray(existingHeaders) && !isLegacyAnswerSheetHeaders(existingHeaders)
    ? existingHeaders
        .filter(helper.isValid)
        .filter(header => !BASE_ANSWERS_SHEET_HEADERS.includes(header))
    : []

  let headers = [...BASE_ANSWERS_SHEET_HEADERS, ...existingDynamicHeaders]

  rows.forEach(row => {
    headers = normalizeHeaders(headers, row)
  })

  return headers
}

function pivotLegacyAnswerRows(values: string[][], headers: string[]): LeadAnswerSheetRow[] {
  const leadIdColumnIndex = headers.indexOf(LEAD_ID_HEADER)
  const quizNameColumnIndex = headers.indexOf(QUIZ_NAME_HEADER)
  const submittedAtColumnIndex = headers.indexOf(SUBMITTED_AT_HEADER)
  const questionColumnIndex = headers.indexOf(LEGACY_QUESTION_HEADER)
  const answerColumnIndex = headers.indexOf(LEGACY_ANSWER_HEADER)

  if (
    leadIdColumnIndex < 0 ||
    quizNameColumnIndex < 0 ||
    submittedAtColumnIndex < 0 ||
    questionColumnIndex < 0 ||
    answerColumnIndex < 0
  ) {
    return []
  }

  const rowsByLeadId = new Map<string, LeadAnswerSheetRow>()

  values.slice(1).forEach((valuesRow, index) => {
    const leadId = normalizeText(valuesRow[leadIdColumnIndex])

    if (!leadId) {
      return
    }

    const existingRow = rowsByLeadId.get(leadId) || {
      'Lead ID': leadId,
      'Quiz Name': normalizeText(valuesRow[quizNameColumnIndex]) || '',
      'Submitted At': normalizeText(valuesRow[submittedAtColumnIndex]) || ''
    }
    const question = normalizeText(valuesRow[questionColumnIndex])

    if (question) {
      const header = buildUniqueHeaderKey(existingRow, question, `Question ${index + 1}`)
      existingRow[header] = normalizeText(valuesRow[answerColumnIndex]) || ''
    }

    rowsByLeadId.set(leadId, existingRow)
  })

  return Array.from(rowsByLeadId.values())
}

async function overwriteWorksheetRows(
  sheets: any,
  spreadsheetId: string,
  sheetName: string,
  headers: string[],
  rows: GoogleSheetsRow[]
) {
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: getSheetRange(sheetName, 'A:ZZZ')
  })

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: getSheetRange(sheetName, 'A:ZZZ'),
    valueInputOption: 'RAW',
    requestBody: {
      values: [headers, ...rows.map(row => headers.map(header => row[header] ?? ''))]
    }
  })
}

async function prepareAnswerWorksheet(
  sheets: any,
  spreadsheetId: string,
  sheetId: number,
  sheetName: string,
  pendingRows: LeadAnswerSheetRow[]
) {
  const existingHeaders = await getWorksheetHeaders(sheets, spreadsheetId, sheetName)

  if (isLegacyAnswerSheetHeaders(existingHeaders)) {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: getSheetRange(sheetName, 'A:ZZZ')
    })
    const existingRows = pivotLegacyAnswerRows((response.data.values || []) as string[][], existingHeaders)
    const headers = buildAnswerSheetHeaders([], [...existingRows, ...pendingRows])

    await prepareWorksheetColumns(sheets, spreadsheetId, sheetId, sheetName, headers)
    await overwriteWorksheetRows(sheets, spreadsheetId, sheetName, headers, existingRows)

    return headers
  }

  const headers = buildAnswerSheetHeaders(existingHeaders, pendingRows)

  await prepareWorksheetColumns(sheets, spreadsheetId, sheetId, sheetName, headers)
  await upsertHeaders(sheets, spreadsheetId, sheetName, headers)

  return headers
}

async function ensureWorksheet(sheets: any, spreadsheetId: string, sheetName: string) {
  const getWorksheetInfo = async (): Promise<WorksheetInfo | undefined> => {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties(sheetId,title)'
    })

    const matchingSheet = spreadsheet.data.sheets?.find(
      (sheet: any) => sheet.properties?.title === sheetName
    )

    if (typeof matchingSheet?.properties?.sheetId !== 'number') {
      return undefined
    }

    return {
      sheetId: matchingSheet.properties.sheetId
    }
  }

  let worksheetInfo = await getWorksheetInfo()

  if (!worksheetInfo) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName
              }
            }
          }
        ]
      }
    })

    worksheetInfo = await getWorksheetInfo()
  }

  if (!worksheetInfo) {
    throw new Error(`Google Sheets worksheet "${sheetName}" could not be created`)
  }

  return worksheetInfo
}

async function getWorksheetHeaders(sheets: any, spreadsheetId: string, sheetName: string) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: getSheetRange(sheetName, '1:1')
  })

  return ((response.data.values || [])[0] || []) as string[]
}

async function moveWorksheetColumn(
  sheets: any,
  spreadsheetId: string,
  sheetId: number,
  startIndex: number,
  destinationIndex: number
) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          moveDimension: {
            source: {
              sheetId,
              dimension: 'COLUMNS',
              startIndex,
              endIndex: startIndex + 1
            },
            destinationIndex
          }
        }
      ]
    }
  })
}

async function insertWorksheetColumn(
  sheets: any,
  spreadsheetId: string,
  sheetId: number,
  columnIndex: number
) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: {
              sheetId,
              dimension: 'COLUMNS',
              startIndex: columnIndex,
              endIndex: columnIndex + 1
            },
            inheritFromBefore: false
          }
        }
      ]
    }
  })
}

async function deleteWorksheetColumns(
  sheets: any,
  spreadsheetId: string,
  sheetId: number,
  startIndex: number,
  endIndex: number
) {
  if (endIndex <= startIndex) {
    return
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'COLUMNS',
              startIndex,
              endIndex
            }
          }
        }
      ]
    }
  })
}

async function prepareWorksheetColumns(
  sheets: any,
  spreadsheetId: string,
  sheetId: number,
  sheetName: string,
  expectedHeaders: string[]
) {
  for (const [index, header] of expectedHeaders.entries()) {
    const currentHeaders = await getWorksheetHeaders(sheets, spreadsheetId, sheetName)
    const currentIndex = currentHeaders.indexOf(header)

    if (currentIndex === index) {
      continue
    }

    if (currentIndex >= 0) {
      await moveWorksheetColumn(sheets, spreadsheetId, sheetId, currentIndex, index)
      continue
    }

    await insertWorksheetColumn(sheets, spreadsheetId, sheetId, index)
  }

  const finalHeaders = await getWorksheetHeaders(sheets, spreadsheetId, sheetName)

  if (finalHeaders.length > expectedHeaders.length) {
    await deleteWorksheetColumns(sheets, spreadsheetId, sheetId, expectedHeaders.length, finalHeaders.length)
  }

  return expectedHeaders
}

async function upsertHeaders(
  sheets: any,
  spreadsheetId: string,
  sheetName: string,
  headers: string[]
) {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: getSheetRange(sheetName, '1:1'),
    valueInputOption: 'RAW',
    requestBody: {
      values: [headers]
    }
  })
}

async function appendRow(
  sheets: any,
  spreadsheetId: string,
  sheetName: string,
  headers: string[],
  row: GoogleSheetsRow
) {
  const rowNumbers = await appendRows(sheets, spreadsheetId, sheetName, headers, [row])

  return rowNumbers[0]
}

async function appendRows(
  sheets: any,
  spreadsheetId: string,
  sheetName: string,
  headers: string[],
  rows: GoogleSheetsRow[]
) {
  if (helper.isEmpty(rows)) {
    return []
  }

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: getSheetRange(sheetName, 'A:ZZZ'),
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: rows.map(row => headers.map(header => row[header] ?? ''))
    }
  })

  return parseUpdatedRangeRowNumbers(response.data.updates?.updatedRange, rows.length)
}

async function setLeadAnswerLinks(
  sheets: any,
  spreadsheetId: string,
  sheetName: string,
  headers: string[],
  answersSheetId: number,
  answersSheetName: string,
  entries: Array<{ rowNumber: number; leadId: string }>
) {
  if (helper.isEmpty(entries)) {
    return
  }

  const viewAnswersColumnIndex = getColumnIndex(headers, VIEW_ANSWERS_HEADER)

  if (viewAnswersColumnIndex < 0) {
    return
  }

  const viewAnswersColumnLetter = getColumnLetter(viewAnswersColumnIndex + 1)

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: entries.map(entry => ({
        range: getSheetRange(sheetName, `${viewAnswersColumnLetter}${entry.rowNumber}`),
        values: [[buildViewAnswersFormula(spreadsheetId, answersSheetId, answersSheetName, entry.leadId)]]
      }))
    }
  })
}

async function findMatchingRowNumbers(
  sheets: any,
  spreadsheetId: string,
  sheetName: string,
  headers: string[],
  matchColumn: string,
  matchValue: string
) {
  const matchColumnIndex = headers.indexOf(matchColumn)

  if (matchColumnIndex === -1) {
    throw new Error(`Google Sheets upsert column "${matchColumn}" was not found in the worksheet header row`)
  }

  const columnLetter = getColumnLetter(matchColumnIndex + 1)
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: getSheetRange(sheetName, `${columnLetter}2:${columnLetter}`)
  })
  const values = (response.data.values || []) as string[][]

  return values.reduce<number[]>((result, row, index) => {
    if (normalizeText(row?.[0]) === matchValue) {
      result.push(index + 2)
    }

    return result
  }, [])
}

async function findMatchingRowNumber(
  sheets: any,
  spreadsheetId: string,
  sheetName: string,
  headers: string[],
  matchColumn: string,
  matchValue: string
) {
  const rowNumbers = await findMatchingRowNumbers(
    sheets,
    spreadsheetId,
    sheetName,
    headers,
    matchColumn,
    matchValue
  )

  return rowNumbers[0]
}

async function deleteWorksheetRows(
  sheets: any,
  spreadsheetId: string,
  sheetId: number,
  rowNumbers: number[]
) {
  if (helper.isEmpty(rowNumbers)) {
    return
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [...rowNumbers]
        .sort((left, right) => right - left)
        .map(rowNumber => ({
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowNumber - 1,
              endIndex: rowNumber
            }
          }
        }))
    }
  })
}

async function getCellValue(
  sheets: any,
  spreadsheetId: string,
  sheetName: string,
  rowNumber: number,
  columnIndex: number
) {
  const columnLetter = getColumnLetter(columnIndex + 1)
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: getSheetRange(sheetName, `${columnLetter}${rowNumber}`)
  })

  return response.data.values?.[0]?.[0]
}

async function updateRow(
  sheets: any,
  spreadsheetId: string,
  sheetName: string,
  headers: string[],
  rowNumber: number,
  row: GoogleSheetsRow
) {
  const lastColumn = getColumnLetter(headers.length)
  const nextRowValues = headers.map(header => row[header] ?? '')
  const leadContactedColumnIndex = getColumnIndex(headers, LEAD_CONTACTED_HEADER)

  if (leadContactedColumnIndex >= 0) {
    const existingLeadContactedValue = await getCellValue(
      sheets,
      spreadsheetId,
      sheetName,
      rowNumber,
      leadContactedColumnIndex
    )

    if (existingLeadContactedValue === 'TRUE') {
      nextRowValues[leadContactedColumnIndex] = true
    } else if (existingLeadContactedValue === 'FALSE') {
      nextRowValues[leadContactedColumnIndex] = false
    }
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: getSheetRange(sheetName, `A${rowNumber}:${lastColumn}${rowNumber}`),
    valueInputOption: 'RAW',
    requestBody: {
      values: [nextRowValues]
    }
  })
}

async function getWorksheetDataRowCount(
  sheets: any,
  spreadsheetId: string,
  sheetName: string,
  headers: string[]
) {
  const leadIdColumnIndex = getColumnIndex(headers, LEAD_ID_HEADER)
  const targetColumnIndex = leadIdColumnIndex >= 0 ? leadIdColumnIndex : 0
  const targetColumnLetter = getColumnLetter(targetColumnIndex + 1)
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: getSheetRange(sheetName, `${targetColumnLetter}2:${targetColumnLetter}`)
  })

  return ((response.data.values || []) as string[][]).length
}

async function ensureIterativeCalculationEnabled(sheets: any, spreadsheetId: string) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSpreadsheetProperties: {
            properties: {
              iterativeCalculationSettings: {
                maxIterations: 1,
                convergenceThreshold: 0.05
              }
            },
            fields:
              'iterativeCalculationSettings.maxIterations,iterativeCalculationSettings.convergenceThreshold'
          }
        }
      ]
    }
  })
}

function buildLeadContactedAtFormula(
  rowNumber: number,
  leadContactedColumnIndex: number,
  leadContactedAtColumnIndex: number
) {
  const leadContactedCell = `${getColumnLetter(leadContactedColumnIndex + 1)}${rowNumber}`
  const leadContactedAtCell = `${getColumnLetter(leadContactedAtColumnIndex + 1)}${rowNumber}`

  return `=IF(${leadContactedCell},IF(${leadContactedAtCell}="",NOW(),${leadContactedAtCell}),"")`
}

async function syncLeadContactedTimestampColumn(
  sheets: any,
  spreadsheetId: string,
  sheetName: string,
  headers: string[],
  dataRowCount: number
) {
  const leadContactedColumnIndex = getColumnIndex(headers, LEAD_CONTACTED_HEADER)
  const leadContactedAtColumnIndex = getColumnIndex(headers, LEAD_CONTACTED_AT_HEADER)

  if (leadContactedColumnIndex < 0 || leadContactedAtColumnIndex < 0 || dataRowCount < 1) {
    return
  }

  await ensureIterativeCalculationEnabled(sheets, spreadsheetId)

  const leadContactedAtColumnLetter = getColumnLetter(leadContactedAtColumnIndex + 1)
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: getSheetRange(sheetName, `${leadContactedAtColumnLetter}2:${leadContactedAtColumnLetter}${dataRowCount + 1}`)
  })
  const existingValues = (response.data.values || []) as string[][]
  const data = Array.from({ length: dataRowCount }, (_, index) => index + 2)
    .filter(rowNumber => !normalizeText(existingValues[rowNumber - 2]?.[0]))
    .map(rowNumber => ({
      range: getSheetRange(sheetName, `${leadContactedAtColumnLetter}${rowNumber}`),
      values: [[buildLeadContactedAtFormula(rowNumber, leadContactedColumnIndex, leadContactedAtColumnIndex)]]
    }))

  if (helper.isEmpty(data)) {
    return
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data
    }
  })
}

async function formatWorksheetLayout(
  sheets: any,
  spreadsheetId: string,
  sheetId: number,
  headers: string[],
  dataRowCount: number
) {
  if (helper.isEmpty(headers)) {
    return
  }

  const leadContactedColumnIndex = getColumnIndex(headers, LEAD_CONTACTED_HEADER)
  const sortSpecs = buildDefaultSortSpecs(headers)

  const requests: any[] = [
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: {
            frozenRowCount: 1
          }
        },
        fields: 'gridProperties.frozenRowCount'
      }
    },
    {
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'ROWS',
          startIndex: 0,
          endIndex: 1
        },
        properties: {
          pixelSize: HEADER_ROW_PIXEL_SIZE
        },
        fields: 'pixelSize'
      }
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: headers.length
        },
        cell: {
          userEnteredFormat: buildUserEnteredFormat({
            backgroundColor: HEADER_BACKGROUND_COLOR,
            textColor: HEADER_TEXT_COLOR,
            bold: true,
            horizontalAlignment: 'LEFT',
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'WRAP'
          })
        },
        fields:
          'userEnteredFormat(backgroundColor,textFormat.foregroundColor,textFormat.bold,horizontalAlignment,verticalAlignment,wrapStrategy)'
      }
    },
    {
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: 0,
          endIndex: headers.length
        },
        properties: {
          pixelSize: DEFAULT_COLUMN_WIDTH
        },
        fields: 'pixelSize'
      }
    },
    {
      setBasicFilter: {
        filter: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: Math.max(dataRowCount + 1, 1),
            startColumnIndex: 0,
            endColumnIndex: headers.length
          },
          ...(helper.isEmpty(sortSpecs)
            ? {}
            : {
                sortSpecs
              })
        }
      }
    }
  ]

  if (dataRowCount > 0) {
    requests.push(
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: dataRowCount + 1,
            startColumnIndex: 0,
            endColumnIndex: headers.length
          },
          cell: {
            userEnteredFormat: buildUserEnteredFormat({
              backgroundColor: BASE_ROW_BACKGROUND_COLOR,
              textColor: DEFAULT_TEXT_COLOR,
              horizontalAlignment: 'LEFT',
              verticalAlignment: 'MIDDLE',
              wrapStrategy: 'CLIP'
            })
          },
          fields:
            'userEnteredFormat(backgroundColor,textFormat.foregroundColor,horizontalAlignment,verticalAlignment,wrapStrategy)'
        }
      },
      {
        updateDimensionProperties: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: 1,
            endIndex: dataRowCount + 1
          },
          properties: {
            pixelSize: DATA_ROW_PIXEL_SIZE
          },
          fields: 'pixelSize'
        }
      }
    )
  }

  if (leadContactedColumnIndex >= 0 && dataRowCount > 0) {
    requests.push(
      {
        setDataValidation: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: dataRowCount + 1,
            startColumnIndex: leadContactedColumnIndex,
            endColumnIndex: leadContactedColumnIndex + 1
          },
          rule: {
            condition: {
              type: 'BOOLEAN'
            },
            strict: true,
            showCustomUi: true
          }
        }
      },
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: dataRowCount + 1,
            startColumnIndex: leadContactedColumnIndex,
            endColumnIndex: leadContactedColumnIndex + 1
          },
          cell: {
            userEnteredFormat: buildUserEnteredFormat({
              textColor: DEFAULT_TEXT_COLOR,
              horizontalAlignment: 'LEFT',
              verticalAlignment: 'MIDDLE',
              wrapStrategy: 'CLIP'
            })
          },
          fields:
            'userEnteredFormat(textFormat.foregroundColor,horizontalAlignment,verticalAlignment,wrapStrategy)'
        }
      }
    )
  }

  headers.forEach((header, index) => {
    const pixelSize = COLUMN_WIDTH_OVERRIDES[header]

    if (!pixelSize) {
      return
    }

    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: index,
          endIndex: index + 1
        },
        properties: {
          pixelSize
        },
        fields: 'pixelSize'
      }
    })
  })

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests
    }
  })
}

async function sortWorksheetRows(
  sheets: any,
  spreadsheetId: string,
  sheetId: number,
  headers: string[],
  dataRowCount: number
) {
  const sortSpecs = buildDefaultSortSpecs(headers)

  if (dataRowCount <= 1 || helper.isEmpty(sortSpecs)) {
    return
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          sortRange: {
            range: {
              sheetId,
              startRowIndex: 1,
              endRowIndex: dataRowCount + 1,
              startColumnIndex: 0,
              endColumnIndex: headers.length
            },
            sortSpecs
          }
        }
      ]
    }
  })
}

async function formatLeadColumns(
  sheets: any,
  spreadsheetId: string,
  sheetId: number,
  sheetName: string,
  headers: string[]
) {
  const leadLevelColumnIndex = getColumnIndex(headers, 'Lead Level')

  if (leadLevelColumnIndex === -1) {
    return
  }

  const leadLevelColumnLetter = getColumnLetter(leadLevelColumnIndex + 1)
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: getSheetRange(sheetName, `${leadLevelColumnLetter}2:${leadLevelColumnLetter}`)
  })
  const leadLevelValues = (response.data.values || []) as string[][]

  if (helper.isEmpty(leadLevelValues)) {
    return
  }

  const requests: any[] = []

  leadLevelValues.forEach((row, index) => {
    const level = normalizeText(row?.[0])?.toLowerCase() as LeadLevel | undefined

    if (!level || !Object.prototype.hasOwnProperty.call(LEAD_LEVEL_ROW_FORMATS, level)) {
      return
    }

    const format = LEAD_LEVEL_ROW_FORMATS[level]

    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: index + 1,
          endRowIndex: index + 2,
          startColumnIndex: 0,
          endColumnIndex: headers.length
        },
        cell: {
          userEnteredFormat: buildUserEnteredFormat({
            backgroundColor: format.backgroundColor,
            textColor: format.textColor
          })
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat.foregroundColor)'
      }
    })
  })

  if (helper.isEmpty(requests)) {
    return
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests
    }
  })
}

async function formatWorksheet(
  sheets: any,
  spreadsheetId: string,
  sheetId: number,
  sheetName: string,
  headers: string[]
) {
  const dataRowCount = await getWorksheetDataRowCount(sheets, spreadsheetId, sheetName, headers)

  await formatWorksheetLayout(sheets, spreadsheetId, sheetId, headers, dataRowCount)
  await sortWorksheetRows(sheets, spreadsheetId, sheetId, headers, dataRowCount)
  await syncLeadContactedTimestampColumn(sheets, spreadsheetId, sheetName, headers, dataRowCount)
  await formatLeadColumns(sheets, spreadsheetId, sheetId, sheetName, headers)
}

async function replaceAnswerRows(
  sheets: any,
  spreadsheetId: string,
  sheetId: number,
  sheetName: string,
  headers: string[],
  leadId: string,
  rows: LeadAnswerSheetRow[]
) {
  const existingRowNumbers = await findMatchingRowNumbers(
    sheets,
    spreadsheetId,
    sheetName,
    headers,
    LEAD_ID_HEADER,
    leadId
  )

  if (!helper.isEmpty(existingRowNumbers)) {
    await deleteWorksheetRows(sheets, spreadsheetId, sheetId, existingRowNumbers)
  }

  await appendRows(
    sheets,
    spreadsheetId,
    sheetName,
    headers,
    rows.map(row => ({ ...row }))
  )
}

function groupTestPayloadsByDestination(config: GoogleSheetsConfig, payloads: LeadCapturePayload[]) {
  const groups = new Map<
    string,
    {
      level?: LeadLevel
      spreadsheetId: string
      sheetName: string
      answersSheetName: string
      leadHeaders: string[]
      leadRows: GoogleSheetsRow[]
      answerRows: LeadAnswerSheetRow[]
      submissionIds: string[]
      leadLevels: Array<LeadLevel | undefined>
    }
  >()

  for (const payload of payloads) {
    const destination = resolveSheetDestination(config, payload)
    const key = [destination.spreadsheetId, destination.sheetName, destination.answersSheetName].join('::')
    const row = applyColumnMapping(buildLeadSheetRow(payload), payload, config)
    const answerRows = buildLeadAnswerSheetRows(payload).map(answerRow => ({ ...answerRow }))
    const existingGroup = groups.get(key) || {
      ...destination,
      leadHeaders: [...BASE_LEAD_SHEET_HEADERS],
      leadRows: [],
      answerRows: [],
      submissionIds: [],
      leadLevels: []
    }

    existingGroup.leadHeaders = normalizeHeaders(existingGroup.leadHeaders, row)
    existingGroup.leadRows.push(row)
    existingGroup.answerRows.push(...answerRows)
    existingGroup.submissionIds.push(payload.submissionId)
    existingGroup.leadLevels.push(payload.leadLevel)

    groups.set(key, existingGroup)
  }

  return Array.from(groups.values())
}

async function writeTestLeadRows(config: GoogleSheetsConfig, payloads: LeadCapturePayload[]) {
  const auth = getJwtClient(config)
  const sheets = google.sheets({ version: 'v4', auth })
  const groups = groupTestPayloadsByDestination(config, payloads)

  for (const group of groups) {
    const worksheetInfo = await ensureWorksheet(sheets, group.spreadsheetId, group.sheetName)
    const answersWorksheetInfo = await ensureWorksheet(
      sheets,
      group.spreadsheetId,
      group.answersSheetName
    )

    await prepareWorksheetColumns(
      sheets,
      group.spreadsheetId,
      worksheetInfo.sheetId,
      group.sheetName,
      group.leadHeaders
    )
    await upsertHeaders(sheets, group.spreadsheetId, group.sheetName, group.leadHeaders)
    const leadRowNumbers = await appendRows(
      sheets,
      group.spreadsheetId,
      group.sheetName,
      group.leadHeaders,
      group.leadRows
    )
    await setLeadAnswerLinks(
      sheets,
      group.spreadsheetId,
      group.sheetName,
      group.leadHeaders,
      answersWorksheetInfo.sheetId,
      group.answersSheetName,
      leadRowNumbers.map((rowNumber, index) => ({
        rowNumber,
        leadId: group.submissionIds[index]
      }))
    )
    await formatWorksheet(
      sheets,
      group.spreadsheetId,
      worksheetInfo.sheetId,
      group.sheetName,
      group.leadHeaders
    )

    const answerHeaders = await prepareAnswerWorksheet(
      sheets,
      group.spreadsheetId,
      answersWorksheetInfo.sheetId,
      group.answersSheetName,
      group.answerRows
    )
    await appendRows(
      sheets,
      group.spreadsheetId,
      group.answersSheetName,
      answerHeaders,
      group.answerRows
    )
    await formatWorksheet(
      sheets,
      group.spreadsheetId,
      answersWorksheetInfo.sheetId,
      group.answersSheetName,
      answerHeaders
    )
  }

  const lastGroup = groups[groups.length - 1]

  return {
    spreadsheetId: lastGroup?.spreadsheetId,
    sheetName: lastGroup?.sheetName,
    answersSheetName: lastGroup?.answersSheetName,
    submissionIds: payloads.map(payload => payload.submissionId),
    leadLevels: payloads.map(payload => payload.leadLevel),
    sampleCount: payloads.length,
    destinations: groups.map(group => ({
      spreadsheetId: group.spreadsheetId,
      sheetName: group.sheetName,
      answersSheetName: group.answersSheetName,
      leadRowCount: group.leadRows.length,
      answerRowCount: group.answerRows.length,
      submissionIds: group.submissionIds,
      leadLevels: group.leadLevels
    })),
    test: true
  }
}

async function writeLeadRow(
  config: GoogleSheetsConfig,
  payload: LeadCapturePayload,
  submission?: { sessionId?: string }
) {
  const destination = resolveSheetDestination(config, payload)
  const auth = getJwtClient(config)
  const sheets = google.sheets({ version: 'v4', auth })
  const trafficSource = await resolveTrafficSource(payload.formId, submission, payload)
  const enrichedPayload = trafficSource ? { ...payload, trafficSource } : payload
  const row = applyColumnMapping(buildLeadSheetRow(enrichedPayload), enrichedPayload, config)
  const headers = normalizeHeaders(BASE_LEAD_SHEET_HEADERS, row)
  const answerRows: LeadAnswerSheetRow[] = buildLeadAnswerSheetRows(enrichedPayload)

  const worksheetInfo = await ensureWorksheet(sheets, destination.spreadsheetId, destination.sheetName)
  const answersWorksheetInfo = await ensureWorksheet(
    sheets,
    destination.spreadsheetId,
    destination.answersSheetName
  )
  await prepareWorksheetColumns(
    sheets,
    destination.spreadsheetId,
    worksheetInfo.sheetId,
    destination.sheetName,
    headers
  )

  await upsertHeaders(sheets, destination.spreadsheetId, destination.sheetName, headers)

  let updated = false
  let appended = false
  let matchColumn: string | undefined
  let matchValue: string | undefined
  let leadRowNumber: number | undefined

  if (getWriteMode(config) === 'upsert') {
    matchColumn = getUpsertMatchColumn(config)
    matchValue = resolveUpsertMatchValue(config, enrichedPayload, row, matchColumn)
    const existingRowNumber = await findMatchingRowNumber(
      sheets,
      destination.spreadsheetId,
      destination.sheetName,
      headers,
      matchColumn,
      matchValue
    )

    if (existingRowNumber) {
      await updateRow(
        sheets,
        destination.spreadsheetId,
        destination.sheetName,
        headers,
        existingRowNumber,
        row
      )

      leadRowNumber = existingRowNumber
      updated = true
    } else {
      leadRowNumber = await appendRow(sheets, destination.spreadsheetId, destination.sheetName, headers, row)
      appended = true
    }
  } else {
    leadRowNumber = await appendRow(sheets, destination.spreadsheetId, destination.sheetName, headers, row)
    appended = true
  }

  if (leadRowNumber) {
    await setLeadAnswerLinks(
      sheets,
      destination.spreadsheetId,
      destination.sheetName,
      headers,
      answersWorksheetInfo.sheetId,
      destination.answersSheetName,
      [{ rowNumber: leadRowNumber, leadId: enrichedPayload.submissionId }]
    )
  }

  await formatWorksheet(
    sheets,
    destination.spreadsheetId,
    worksheetInfo.sheetId,
    destination.sheetName,
    headers
  )

  const answerHeaders = await prepareAnswerWorksheet(
    sheets,
    destination.spreadsheetId,
    answersWorksheetInfo.sheetId,
    destination.answersSheetName,
    answerRows
  )
  await replaceAnswerRows(
    sheets,
    destination.spreadsheetId,
    answersWorksheetInfo.sheetId,
    destination.answersSheetName,
    answerHeaders,
    enrichedPayload.submissionId,
    answerRows
  )
  await formatWorksheet(
    sheets,
    destination.spreadsheetId,
    answersWorksheetInfo.sheetId,
    destination.answersSheetName,
    answerHeaders
  )

  return {
    ...destination,
    updated,
    appended,
    matchColumn,
    matchValue,
    answerRowCount: answerRows.length,
    trafficSource: enrichedPayload.trafficSource
  }
}

export default {
  id: 'googlesheets',
  name: 'Google Sheets',
  description:
    'Send each submission to a clean Google Sheets leads tab plus a linked one-row-per-lead answers tab, with service-account auth and optional upsert updates.',
  icon: '/static/googleanalytics.png',
  settings: [
    {
      type: 'text',
      name: 'spreadsheetId',
      label: 'Spreadsheet ID',
      description: 'Default spreadsheet used when no lead-level override is matched.',
      placeholder: '1abcDEFghiJKLmnopqrstuvWXYZ1234567890',
      required: true
    },
    {
      type: 'text',
      name: 'sheetName',
      label: 'Leads worksheet name',
      description: 'Main worksheet with one clean row per lead.',
      placeholder: 'Leads',
      required: false
    },
    {
      type: 'text',
      name: 'answersSheetName',
      label: 'Answers worksheet name',
      description: 'Optional worksheet with one row per question answer keyed by Lead ID.',
      placeholder: 'Lead Answers',
      required: false
    },
    {
      type: 'switch',
      name: 'routeByLeadLevel',
      label: 'Route by lead level',
      description: 'Enable separate spreadsheet or worksheet destinations for high, medium, and low leads.',
      defaultValue: false,
      required: false
    },
    {
      type: 'text',
      name: 'spreadsheetIdHigh',
      label: 'High lead spreadsheet ID',
      placeholder: '1abcDEFghiJKLmnopqrstuvWXYZ1234567890',
      required: false
    },
    {
      type: 'text',
      name: 'sheetNameHigh',
      label: 'High lead worksheet',
      placeholder: 'Hot Leads',
      required: false
    },
    {
      type: 'text',
      name: 'spreadsheetIdMedium',
      label: 'Medium lead spreadsheet ID',
      placeholder: '1abcDEFghiJKLmnopqrstuvWXYZ1234567890',
      required: false
    },
    {
      type: 'text',
      name: 'sheetNameMedium',
      label: 'Medium lead worksheet',
      placeholder: 'Warm Leads',
      required: false
    },
    {
      type: 'text',
      name: 'spreadsheetIdLow',
      label: 'Low lead spreadsheet ID',
      placeholder: '1abcDEFghiJKLmnopqrstuvWXYZ1234567890',
      required: false
    },
    {
      type: 'text',
      name: 'sheetNameLow',
      label: 'Low lead worksheet',
      placeholder: 'Cold Leads',
      required: false
    },
    {
      type: 'select',
      name: 'writeMode',
      label: 'Write mode',
      description: 'Append always creates a new row. Upsert updates the first row matching your key column.',
      placeholder: 'Append new rows',
      options: [
        {
          label: 'Append new rows',
          value: 'append'
        },
        {
          label: 'Upsert matching row',
          value: 'upsert'
        }
      ],
      defaultValue: 'append',
      required: false
    },
    {
      type: 'text',
      name: 'upsertMatchColumn',
      label: 'Upsert match column',
      description: 'Required for upsert mode. Example: Lead ID or Respondent Email.',
      placeholder: 'Lead ID',
      required: false
    },
    {
      type: 'text',
      name: 'upsertValueTemplate',
      label: 'Upsert match value template',
      description:
        'Optional. Use tokens like {leadId}, {respondentEmail}, {trafficSource}, {leadLevel}, or {hidden.utm_source}.',
      placeholder: '{leadId}',
      required: false
    },
    {
      type: 'textarea',
      name: 'columnMappingJson',
      label: 'Column mapping JSON',
      description:
        'Optional JSON object used to add or override lead-tab columns. Example: {"Owner":"{leadPriority}","Source":"{trafficSource}"}',
      placeholder: '{\n  "CRM Owner": "{leadPriority}",\n  "Source": "{hidden.utm_source}"\n}',
      required: false
    },
    {
      type: 'text',
      name: 'serviceAccountEmail',
      label: 'Service account email',
      placeholder: 'heyform-sync@project-id.iam.gserviceaccount.com',
      required: true
    },
    {
      type: 'textarea',
      name: 'serviceAccountPrivateKey',
      label: 'Service account private key',
      description:
        'Paste the private key from your Google service account JSON. Literal \\n sequences are supported.',
      placeholder: '-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n',
      required: true
    }
  ],
  run: async ({ config, submission, form, team, project }) => {
    const payload = buildLeadCapturePayload(form, submission, team, project)
    const result = await writeLeadRow(config, payload, submission)

    return {
      ...result,
      submissionId: submission.id,
      leadLevel: payload.leadLevel
    }
  },
  test: async ({ config, form, team }) => {
    const payloads = buildTestLeadCapturePayloads(form, team, getTestLeadCount(config))

    return writeTestLeadRows(config, payloads)
  }
}
