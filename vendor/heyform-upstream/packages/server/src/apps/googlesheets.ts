import { google } from 'googleapis'

import { helper } from '@heyform-inc/utils'

import {
  buildLeadCapturePayload,
  buildLeadSheetRow,
  buildLeadTemplateValues,
  buildTestLeadCapturePayload,
  interpolateLeadTemplate,
  LeadCapturePayload
} from '../utils'

const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const DEFAULT_SHEET_NAME = 'Leads'

type GoogleSheetsConfig = Record<string, any>
type GoogleSheetsRow = Record<string, string | number>
type LeadLevel = 'high' | 'medium' | 'low'
type WriteMode = 'append' | 'upsert'

function getSheetRange(sheetName: string, range: string) {
  return `'${sheetName.replace(/'/g, "''")}'!${range}`
}

function normalizeText(value: unknown): string | undefined {
  if (helper.isNil(value)) {
    return undefined
  }

  const normalized = String(value).trim()
  return helper.isValid(normalized) ? normalized : undefined
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

function normalizeRowValue(value: unknown): string | number {
  if (typeof value === 'number' && Number.isFinite(value)) {
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

function resolveSheetDestination(config: GoogleSheetsConfig, payload: LeadCapturePayload) {
  const routedLevel = shouldRouteByLeadLevel(config) && payload.leadLevel ? payload.leadLevel : undefined

  return {
    level: routedLevel,
    spreadsheetId: getSpreadsheetId(config, routedLevel),
    sheetName: getSheetName(config, routedLevel)
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

function normalizeHeaders(existingHeaders: string[], nextRow: Record<string, string | number>) {
  const normalizedHeaders = existingHeaders.filter(helper.isValid)

  Object.keys(nextRow).forEach(key => {
    if (!normalizedHeaders.includes(key)) {
      normalizedHeaders.push(key)
    }
  })

  return normalizedHeaders
}

async function ensureWorksheet(sheets: any, spreadsheetId: string, sheetName: string) {
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title'
  })

  const hasSheet = spreadsheet.data.sheets?.some(
    (sheet: any) => sheet.properties?.title === sheetName
  )

  if (!hasSheet) {
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
  }
}

async function getMergedHeaders(
  sheets: any,
  spreadsheetId: string,
  sheetName: string,
  nextRow: Record<string, string | number>
) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: getSheetRange(sheetName, '1:1')
  })
  const existingHeaders = ((response.data.values || [])[0] || []) as string[]

  return normalizeHeaders(existingHeaders, nextRow)
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
  row: Record<string, string | number>
) {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: getSheetRange(sheetName, 'A:ZZZ'),
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [headers.map(header => row[header] ?? '')]
    }
  })
}

async function findMatchingRowNumber(
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
  const rowIndex = values.findIndex(row => normalizeText(row?.[0]) === matchValue)

  return rowIndex >= 0 ? rowIndex + 2 : undefined
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

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: getSheetRange(sheetName, `A${rowNumber}:${lastColumn}${rowNumber}`),
    valueInputOption: 'RAW',
    requestBody: {
      values: [headers.map(header => row[header] ?? '')]
    }
  })
}

async function writeLeadRow(config: GoogleSheetsConfig, payload: LeadCapturePayload) {
  const destination = resolveSheetDestination(config, payload)
  const auth = getJwtClient(config)
  const sheets = google.sheets({ version: 'v4', auth })
  const row = applyColumnMapping(buildLeadSheetRow(payload), payload, config)

  await ensureWorksheet(sheets, destination.spreadsheetId, destination.sheetName)

  const headers = await getMergedHeaders(sheets, destination.spreadsheetId, destination.sheetName, row)

  await upsertHeaders(sheets, destination.spreadsheetId, destination.sheetName, headers)

  if (getWriteMode(config) === 'upsert') {
    const matchColumn = getUpsertMatchColumn(config)
    const matchValue = resolveUpsertMatchValue(config, payload, row, matchColumn)
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

      return {
        ...destination,
        matchColumn,
        matchValue,
        updated: true,
        appended: false
      }
    }

    await appendRow(sheets, destination.spreadsheetId, destination.sheetName, headers, row)

    return {
      ...destination,
      matchColumn,
      matchValue,
      updated: false,
      appended: true
    }
  }

  await appendRow(sheets, destination.spreadsheetId, destination.sheetName, headers, row)

  return {
    ...destination,
    updated: false,
    appended: true
  }
}

export default {
  id: 'googlesheets',
  name: 'Google Sheets',
  description:
    'Send each submission to Google Sheets with service-account auth, score-based routing, optional upsert updates, and configurable lead-field mappings.',
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
      label: 'Worksheet name',
      description: 'Default worksheet for incoming leads.',
      placeholder: 'Leads',
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
      description: 'Required for upsert mode. Example: Respondent Email, Submission ID, or a mapped CRM key column.',
      placeholder: 'Respondent Email',
      required: false
    },
    {
      type: 'text',
      name: 'upsertValueTemplate',
      label: 'Upsert match value template',
      description:
        'Optional. Use tokens like {respondentEmail}, {submissionId}, {leadLevel}, {answer.Question}, {variable.Score}, or {hidden.utm_source}.',
      placeholder: '{respondentEmail}',
      required: false
    },
    {
      type: 'textarea',
      name: 'columnMappingJson',
      label: 'Column mapping JSON',
      description:
        'Optional JSON object used to add or override output columns. Example: {"CRM Owner":"{leadPriority}","Source":"{hidden.utm_source}"}',
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
  run: async ({ config, submission, form, team }) => {
    const payload = buildLeadCapturePayload(form, submission, team)
    const result = await writeLeadRow(config, payload)

    return {
      ...result,
      submissionId: submission.id,
      leadLevel: payload.leadLevel
    }
  },
  test: async ({ config, form, team }) => {
    const payload = buildTestLeadCapturePayload(form, team)
    const result = await writeLeadRow(config, payload)

    return {
      ...result,
      submissionId: payload.submissionId,
      leadLevel: payload.leadLevel,
      test: true
    }
  }
}
