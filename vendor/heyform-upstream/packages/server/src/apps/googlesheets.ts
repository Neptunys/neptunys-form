import { google } from 'googleapis'

import { helper } from '@heyform-inc/utils'

import {
  buildLeadCapturePayload,
  buildLeadSheetRow,
  buildLeadTemplateValues,
  buildTestLeadCapturePayloads,
  interpolateLeadTemplate,
  LeadCapturePayload
} from '../utils'

const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const DEFAULT_SHEET_NAME = 'Leads'
const DEFAULT_COLUMN_WIDTH = 150
const HEADER_ROW_PIXEL_SIZE = 42
const DATA_ROW_PIXEL_SIZE = 32
const LEAD_CONTACTED_HEADER = 'Lead Contacted'
const SUBMISSION_ID_HEADER = 'Submission ID'
const LEAD_SCORE_HEADER = 'Lead Score'
const SUBMITTED_AT_HEADER = 'Submitted At (UTC)'
const OBSOLETE_COLUMN_HEADERS = new Set(['Client Name', 'Hidden Fields JSON', 'Variables JSON'])
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
const COLUMN_WIDTH_OVERRIDES: Record<string, number> = {
  'Lead Contacted': 128,
  'Submission ID': 170,
  'Form ID': 110,
  'User ID': 230,
  'User ID Source': 120,
  'Form Name': 220,
  'Project ID': 120,
  'Project Name': 200,
  'Submitted At (UTC)': 185,
  'Respondent Name': 180,
  'Respondent Email': 240,
  'Respondent Phone': 170,
  'Lead Score': 100,
  'Lead Level': 110,
  'Lead Quality': 150,
  'Lead Priority': 130,
  'Lead Score Source': 170,
  'Answers Summary': 320
}
const LEAD_SUMMARY_COLUMN_HEADERS = ['Lead Score', 'Lead Level', 'Lead Quality', 'Lead Priority']

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

  return sortSpecs
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

function normalizeHeaders(existingHeaders: string[], nextRow: GoogleSheetsRow) {
  const normalizedHeaders = existingHeaders.filter(helper.isValid)

  Object.keys(nextRow).forEach(key => {
    if (!normalizedHeaders.includes(key)) {
      normalizedHeaders.push(key)
    }
  })

  return normalizedHeaders
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

async function getMergedHeaders(
  sheets: any,
  spreadsheetId: string,
  sheetName: string,
  nextRow: GoogleSheetsRow
) {
  const existingHeaders = await getWorksheetHeaders(sheets, spreadsheetId, sheetName)

  return normalizeHeaders(existingHeaders, nextRow)
}

async function getWorksheetHeaders(sheets: any, spreadsheetId: string, sheetName: string) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: getSheetRange(sheetName, '1:1')
  })

  return ((response.data.values || [])[0] || []) as string[]
}

async function ensureLeadContactedColumnFirst(
  sheets: any,
  spreadsheetId: string,
  sheetId: number,
  existingHeaders: string[]
) {
  const leadContactedColumnIndex = existingHeaders.indexOf(LEAD_CONTACTED_HEADER)

  if (leadContactedColumnIndex === 0 || helper.isEmpty(existingHeaders)) {
    return false
  }

  if (leadContactedColumnIndex > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            moveDimension: {
              source: {
                sheetId,
                dimension: 'COLUMNS',
                startIndex: leadContactedColumnIndex,
                endIndex: leadContactedColumnIndex + 1
              },
              destinationIndex: 0
            }
          }
        ]
      }
    })

    return true
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: {
              sheetId,
              dimension: 'COLUMNS',
              startIndex: 0,
              endIndex: 1
            },
            inheritFromBefore: false
          }
        }
      ]
    }
  })

  return true
}

async function pruneObsoleteColumns(
  sheets: any,
  spreadsheetId: string,
  sheetId: number,
  existingHeaders: string[]
) {
  const obsoleteColumnIndexes = existingHeaders
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => OBSOLETE_COLUMN_HEADERS.has(header))
    .map(({ index }) => index)
    .sort((left, right) => right - left)

  if (helper.isEmpty(obsoleteColumnIndexes)) {
    return false
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: obsoleteColumnIndexes.map(index => ({
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'COLUMNS',
            startIndex: index,
            endIndex: index + 1
          }
        }
      }))
    }
  })

  return true
}

async function prepareWorksheetColumns(
  sheets: any,
  spreadsheetId: string,
  sheetId: number,
  sheetName: string
) {
  let existingHeaders = await getWorksheetHeaders(sheets, spreadsheetId, sheetName)

  if (await ensureLeadContactedColumnFirst(sheets, spreadsheetId, sheetId, existingHeaders)) {
    existingHeaders = await getWorksheetHeaders(sheets, spreadsheetId, sheetName)
  }

  if (await pruneObsoleteColumns(sheets, spreadsheetId, sheetId, existingHeaders)) {
    existingHeaders = await getWorksheetHeaders(sheets, spreadsheetId, sheetName)
  }

  return existingHeaders
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
  const submissionIdColumnIndex = getColumnIndex(headers, SUBMISSION_ID_HEADER)
  const targetColumnIndex = submissionIdColumnIndex >= 0 ? submissionIdColumnIndex : 0
  const targetColumnLetter = getColumnLetter(targetColumnIndex + 1)
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: getSheetRange(sheetName, `${targetColumnLetter}2:${targetColumnLetter}`)
  })

  return ((response.data.values || []) as string[][]).length
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
            horizontalAlignment: 'CENTER',
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
              verticalAlignment: 'MIDDLE',
              wrapStrategy: 'CLIP'
            })
          },
          fields:
            'userEnteredFormat(backgroundColor,textFormat.foregroundColor,verticalAlignment,wrapStrategy)'
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
              horizontalAlignment: 'CENTER',
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

  const centeredColumnIndexes = LEAD_SUMMARY_COLUMN_HEADERS.map(header => getColumnIndex(headers, header)).filter(
    index => index >= 0
  )

  centeredColumnIndexes.forEach(index => {
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          startColumnIndex: index,
          endColumnIndex: index + 1
        },
        cell: {
          userEnteredFormat: buildUserEnteredFormat({
            textColor: DEFAULT_TEXT_COLOR,
            bold: true,
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'CLIP'
          })
        },
        fields:
          'userEnteredFormat(textFormat.foregroundColor,textFormat.bold,horizontalAlignment,verticalAlignment,wrapStrategy)'
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
  await formatLeadColumns(sheets, spreadsheetId, sheetId, sheetName, headers)
}

async function writeLeadRow(config: GoogleSheetsConfig, payload: LeadCapturePayload) {
  const destination = resolveSheetDestination(config, payload)
  const auth = getJwtClient(config)
  const sheets = google.sheets({ version: 'v4', auth })
  const row = applyColumnMapping(buildLeadSheetRow(payload), payload, config)

  const worksheetInfo = await ensureWorksheet(sheets, destination.spreadsheetId, destination.sheetName)
  await prepareWorksheetColumns(
    sheets,
    destination.spreadsheetId,
    worksheetInfo.sheetId,
    destination.sheetName
  )

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

      await formatWorksheet(
        sheets,
        destination.spreadsheetId,
        worksheetInfo.sheetId,
        destination.sheetName,
        headers
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

    await formatWorksheet(
      sheets,
      destination.spreadsheetId,
      worksheetInfo.sheetId,
      destination.sheetName,
      headers
    )

    return {
      ...destination,
      matchColumn,
      matchValue,
      updated: false,
      appended: true
    }
  }

  await appendRow(sheets, destination.spreadsheetId, destination.sheetName, headers, row)

  await formatWorksheet(
    sheets,
    destination.spreadsheetId,
    worksheetInfo.sheetId,
    destination.sheetName,
    headers
  )

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
    const payloads = buildTestLeadCapturePayloads(form, team)
    let result: Record<string, any> | undefined

    for (const payload of payloads) {
      result = await writeLeadRow(config, payload)
    }

    return {
      ...result,
      submissionIds: payloads.map(payload => payload.submissionId),
      leadLevels: payloads.map(payload => payload.leadLevel),
      sampleCount: payloads.length,
      test: true
    }
  }
}
