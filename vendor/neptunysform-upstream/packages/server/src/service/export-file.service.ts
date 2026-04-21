import {
  Answer,
  FieldKindEnum,
  FormField,
  HiddenField,
  STATEMENT_FIELD_KINDS
} from '@neptunysform-inc/shared-types-enums'
import { Injectable } from '@nestjs/common'
import { parseAsync } from 'json2csv'
import * as XLSX from 'xlsx'

import { htmlUtils, parsePlainAnswer } from '@neptunysform-inc/answer-utils'
import { helper, toDuration, toFixed, unixDate } from '@neptunysform-inc/utils'
import { FormModel, ProjectModel, SubmissionModel } from '@model'
import { buildLeadCapturePayload } from '@utils'

const SUBMISSION_ID_KEY = 'Submission ID'
const STARTED_AT_KEY = 'Started At (UTC)'
const SUBMITTED_AT_KEY = 'Submitted At (UTC)'
const HIDDEN_FIELD_PREFIX = 'Hidden field: '
const CALCULATED_FIELD_PREFIX = 'Calculated field: '

interface ExportDataset {
  fields: string[]
  records: Record<string, any>[]
}

function humanizeSourceChannel(channel?: string) {
  switch (channel) {
    case 'direct':
      return 'Direct link'
    case 'meta':
      return 'Meta'
    case 'google':
      return 'Google'
    case 'linkedin':
      return 'LinkedIn'
    case 'x':
      return 'X'
    case 'youtube':
      return 'YouTube'
    case 'tiktok':
      return 'TikTok'
    case 'email':
      return 'Email'
    case 'other':
      return 'Other'
    default:
      return 'All sources'
  }
}

@Injectable()
export class ExportFileService {
  async csv(
    formFields: FormField[],
    selectedHiddenFields: HiddenField[],
    submissions: SubmissionModel[]
  ): Promise<string> {
    const { fields, records } = this.buildDataset(formFields, selectedHiddenFields, submissions)

    return parseAsync(records, {
      fields
    })
  }

  async xlsx(
    formFields: FormField[],
    selectedHiddenFields: HiddenField[],
    submissions: SubmissionModel[]
  ): Promise<Buffer> {
    const { records } = this.buildDataset(formFields, selectedHiddenFields, submissions)
    const workbook = XLSX.utils.book_new()
    const worksheet = this.jsonToSheet(records, 'No submissions were found for this form.')

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Submissions')

    return XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx'
    }) as Buffer
  }

  async projectReportXlsx(
    project: ProjectModel,
    forms: FormModel[],
    submissions: SubmissionModel[],
    options: {
      startDate: string
      endDate: string
    }
  ): Promise<Buffer> {
    const workbook = XLSX.utils.book_new()
    const formMap = new Map(forms.map(form => [form.id, form]))
    const leads = submissions.reduce<Array<ReturnType<typeof buildLeadCapturePayload>>>(
      (rows, submission) => {
        const form = formMap.get(submission.formId)

        if (!form) {
          return rows
        }

        rows.push(buildLeadCapturePayload(form, submission, undefined, project))
        return rows
      },
      []
    )
    const answerColumns = Array.from(
      new Set(leads.flatMap(lead => Object.keys(lead.answersByTitle)))
    ).sort((left, right) => left.localeCompare(right))
    const hiddenFieldColumns = Array.from(
      new Set(leads.flatMap(lead => Object.keys(lead.hiddenFieldsByName)))
    ).sort((left, right) => left.localeCompare(right))
    const variableColumns = Array.from(
      new Set(leads.flatMap(lead => Object.keys(lead.variablesByName)))
    ).sort((left, right) => left.localeCompare(right))
    const formStats = new Map<
      string,
      {
        leadCount: number
        highPriorityLeadCount: number
        lastLeadAt?: number
      }
    >()

    for (const lead of leads) {
      const stats = formStats.get(lead.formId) || {
        leadCount: 0,
        highPriorityLeadCount: 0,
        lastLeadAt: undefined
      }

      stats.leadCount += 1

      if (lead.leadLevel === 'high') {
        stats.highPriorityLeadCount += 1
      }

      if (!stats.lastLeadAt || lead.submittedAt > stats.lastLeadAt) {
        stats.lastLeadAt = lead.submittedAt
      }

      formStats.set(lead.formId, stats)
    }

    const formRows = forms.map(form => {
      const stats = formStats.get(form.id)
      const leadCount = stats?.leadCount || 0

      return {
        Form: form.name,
        'Form ID': form.id,
        Status: form.settings?.active && !form.suspended ? 'Published' : 'Inactive',
        'Leads in range': leadCount,
        'Lead share %': leads.length > 0 ? toFixed((leadCount / leads.length) * 100) : '0.0',
        'High Priority Leads': stats?.highPriorityLeadCount || 0,
        'Last Lead At (UTC)': stats?.lastLeadAt
          ? new Date(stats.lastLeadAt * 1000).toISOString()
          : ''
      }
    })
    const leadRows = leads.map(lead => {
      const row: Record<string, any> = {
        Project: lead.projectName || project.name,
        'Project ID': lead.projectId || project.id,
        Form: lead.formName,
        'Form ID': lead.formId,
        'Submission ID': lead.submissionId,
        'Submitted At (UTC)': lead.submittedAtIso,
        Respondent: lead.respondentName || '',
        Email: lead.respondentEmail || '',
        Phone: lead.respondentPhone || '',
        Score: helper.isNil(lead.leadScore) ? '' : lead.leadScore,
        'Score band': lead.leadLevel || '',
        Grade: lead.leadQuality || '',
        Priority: lead.leadPriority || '',
        'Score source': lead.leadScoreVariableName || '',
        Summary: lead.answersPlain
      }

      answerColumns.forEach(column => {
        row[`Answer: ${column}`] = lead.answersByTitle[column] || ''
      })

      hiddenFieldColumns.forEach(column => {
        row[`${HIDDEN_FIELD_PREFIX}${column}`] = lead.hiddenFieldsByName[column] || ''
      })

      variableColumns.forEach(column => {
        row[`${CALCULATED_FIELD_PREFIX}${column}`] = helper.isNil(lead.variablesByName[column])
          ? ''
          : lead.variablesByName[column]
      })

      return row
    })

    XLSX.utils.book_append_sheet(
      workbook,
      this.aoaToSheet(this.buildProjectSummaryRows(project, options, leads, formRows)),
      'Summary'
    )
    XLSX.utils.book_append_sheet(
      workbook,
      this.jsonToSheet(formRows, 'No forms were found for this project.'),
      'Form Performance'
    )
    XLSX.utils.book_append_sheet(
      workbook,
      this.jsonToSheet(leadRows, 'No leads were found for the selected date range.'),
      'Lead Log'
    )

    return XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx'
    }) as Buffer
  }

  async formAnalyticsXlsx(
    form: Pick<FormModel, 'id' | 'name'>,
    options: {
      range: string
      startDate?: string
      endDate?: string
      sourceChannel?: string
      dedupeByIp?: boolean
      startAt: Date
      endAt: Date
      summary: {
        avgTotalVisits: number
        avgSubmissionCount: number
        avgAverageTime: number
        sourceBreakdown: Array<{
          channel: string
          totalVisits: number
          submissionCount: number
        }>
      }
      questions: Array<{
        order: number
        title?: string
        reachCount: number
        reachRate: number
        completedCount: number
        dropOffCount: number
        dropOffRate: number
        averageDuration: number
        frictionScore: number
        frictionLevel: string
      }>
    }
  ): Promise<Buffer> {
    const workbook = XLSX.utils.book_new()
    const completionRate =
      options.summary.avgTotalVisits > 0
        ? (options.summary.avgSubmissionCount / options.summary.avgTotalVisits) * 100
        : 0
    const rangeLabel =
      options.range === 'custom' && options.startDate && options.endDate
        ? `${options.startDate} to ${options.endDate}`
        : options.range
    const summaryRows = [
      ['Form analytics export'],
      ['Form', form.name],
      ['Form ID', form.id],
      ['Range', rangeLabel],
      ['From (UTC)', options.startAt.toISOString()],
      ['To (UTC)', options.endAt.toISOString()],
      ['Source filter', humanizeSourceChannel(options.sourceChannel)],
      [
        'Counting mode',
        options.dedupeByIp ? 'One visit and one submission per IP' : 'Every visit and submission'
      ],
      ['Generated at (UTC)', new Date().toISOString()],
      [],
      ['Metric', 'Value'],
      ['Visits', String(options.summary.avgTotalVisits || 0)],
      ['Submissions', String(options.summary.avgSubmissionCount || 0)],
      ['Completion rate', `${toFixed(completionRate)}%`],
      ['Average completion time', toDuration(Math.round(options.summary.avgAverageTime || 0))]
    ]
    const sourceRows = (options.summary.sourceBreakdown || []).map(row => ({
      Channel: humanizeSourceChannel(row.channel),
      Visits: row.totalVisits,
      Submissions: row.submissionCount
    }))
    const questionRows = (options.questions || []).map(question => ({
      Step: question.order,
      Question: question.title || `Question ${question.order}`,
      Reached: question.reachCount,
      'Reach rate %': toFixed(question.reachRate || 0),
      Completed: question.completedCount,
      'Drop-off count': question.dropOffCount,
      'Drop-off rate %': toFixed(question.dropOffRate || 0),
      'Average time': toDuration(Math.round(question.averageDuration || 0)),
      Friction: question.frictionLevel,
      'Friction score': question.frictionScore
    }))

    XLSX.utils.book_append_sheet(workbook, this.aoaToSheet(summaryRows), 'Summary')
    XLSX.utils.book_append_sheet(
      workbook,
      this.jsonToSheet(sourceRows, 'No source data was recorded for the selected range.'),
      'Source Mix'
    )
    XLSX.utils.book_append_sheet(
      workbook,
      this.jsonToSheet(questionRows, 'No question analytics were recorded for the selected range.'),
      'Question Journey'
    )

    return XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx'
    }) as Buffer
  }

  private buildDataset(
    formFields: FormField[],
    selectedHiddenFields: HiddenField[],
    submissions: SubmissionModel[]
  ): ExportDataset {
    const records: Record<string, any>[] = []
    const seenFieldTitles = new Set<string>()
    const selectedFormFields = formFields
      .filter(field => !STATEMENT_FIELD_KINDS.includes(field.kind))
      .map((field, index) => ({
        ...field,
        title: this.makeUniqueExportFieldTitle(
          seenFieldTitles,
          helper.isArray(field.title) ? htmlUtils.serialize(field.title) : field.title,
          index
        )
      }))
    const variableNames = Array.from(
      new Set(
        submissions.flatMap(submission =>
          (submission.variables || [])
            .map(variable => variable.name)
            .filter((name): name is string => helper.isValid(name))
        )
      )
    )

    const fields: string[] = [
      SUBMISSION_ID_KEY,
      STARTED_AT_KEY,
      SUBMITTED_AT_KEY,
      ...selectedFormFields.map(field => field.title),
      ...selectedHiddenFields.map(hiddenField => `${HIDDEN_FIELD_PREFIX}${hiddenField.name}`),
      ...variableNames.map(name => `${CALCULATED_FIELD_PREFIX}${name}`)
    ]

    for (const submission of submissions) {
      const record: Record<string, any> = {
        [SUBMISSION_ID_KEY]: submission.id,
        [STARTED_AT_KEY]: submission.startAt ? unixDate(submission.startAt).toISOString() : '',
        [SUBMITTED_AT_KEY]: submission.endAt ? unixDate(submission.endAt).toISOString() : ''
      }

      for (const field of selectedFormFields) {
        let answer: any = submission.answers.find(answer => answer.id === field.id)

        if (helper.isEmpty(answer)) {
          answer = ''
        } else {
          answer = this.parseAnswer(answer)
        }

        record[field.title] = answer
      }

      for (const selectedHiddenField of selectedHiddenFields) {
        const hiddenFieldValue = submission.hiddenFields.find(
          hiddenField => hiddenField.id === selectedHiddenField.id
        )?.value

        record[`${HIDDEN_FIELD_PREFIX}${selectedHiddenField.name}`] = hiddenFieldValue
      }

      for (const variableName of variableNames) {
        const variableValue = submission.variables.find(variable => variable.name === variableName)?.value

        record[`${CALCULATED_FIELD_PREFIX}${variableName}`] = helper.isNil(variableValue)
          ? ''
          : variableValue
      }

      records.push(record)
    }

    return {
      fields,
      records
    }
  }

  private parseAnswer(answer: Answer): string {
    const value = answer.value
    let result = ''

    if (helper.isEmpty(value)) {
      return result
    }

    switch (answer?.kind) {
      case FieldKindEnum.FILE_UPLOAD:
        result = helper.isObject(value) ? value.url : helper.isString(value) ? value : ''
        break

      default:
        result = parsePlainAnswer(answer)
        break
    }

    return result
  }

  private jsonToSheet(rows: Record<string, any>[], emptyMessage: string) {
    const normalizedRows = rows.length > 0 ? rows : [{ Notice: emptyMessage }]
    const sheet = XLSX.utils.json_to_sheet(normalizedRows)

    this.applyJsonSheetColumnWidths(sheet, normalizedRows)
    return sheet
  }

  private aoaToSheet(rows: Array<Array<string | number>>) {
    const sheet = XLSX.utils.aoa_to_sheet(rows)

    this.applyAoaSheetColumnWidths(sheet, rows)
    return sheet
  }

  private makeUniqueExportFieldTitle(
    seenTitles: Set<string>,
    rawTitle: unknown,
    index: number
  ) {
    const baseTitle = helper.isValid(rawTitle) ? String(rawTitle).trim() : ''
    const normalizedTitle = helper.isValid(baseTitle) ? baseTitle : `Question ${index + 1}`
    let title = normalizedTitle
    let duplicateIndex = 2

    while (seenTitles.has(title)) {
      title = `${normalizedTitle} (${duplicateIndex})`
      duplicateIndex += 1
    }

    seenTitles.add(title)
    return title
  }

  private buildProjectSummaryRows(
    project: ProjectModel,
    options: {
      startDate: string
      endDate: string
    },
    leads: Array<ReturnType<typeof buildLeadCapturePayload>>,
    formRows: Array<Record<string, any>>
  ) {
    const formsWithLeads = formRows.filter(row => Number(row['Leads in Range']) > 0).length
    const highPriorityLeads = leads.filter(lead => lead.leadLevel === 'high').length
    const topForms = [...formRows]
      .filter(row => Number(row['Leads in Range']) > 0)
      .sort((left, right) => Number(right['Leads in Range']) - Number(left['Leads in Range']))
      .slice(0, 10)
    const earliestLead = leads[leads.length - 1]
    const latestLead = leads[0]
    const scoredLeads = leads.filter(lead => helper.isValid(lead.leadScore))
    const averageScore = scoredLeads.length
      ? toFixed(
          scoredLeads.reduce((sum, lead) => sum + (lead.leadScore || 0), 0) / scoredLeads.length
        )
      : '0.0'

    return [
      ['Client report'],
      ['Project', project.name],
      ['Project ID', project.id],
      ['Date range', `${options.startDate} to ${options.endDate}`],
      ['Reporting timezone', project.reportingTimezone || 'UTC'],
      ['Generated at (UTC)', new Date().toISOString()],
      [],
      ['Metric', 'Value'],
      ['Forms included', formRows.length],
      ['Forms with leads', formsWithLeads],
      ['Leads in range', leads.length],
      ['Average score', averageScore],
      ['High priority leads', highPriorityLeads],
      ['First lead at (UTC)', earliestLead?.submittedAtIso || ''],
      ['Last lead at (UTC)', latestLead?.submittedAtIso || ''],
      [],
      ['Top forms', 'Leads in range'],
      ...(topForms.length > 0
        ? topForms.map(row => [row.Form, row['Leads in range']])
        : [['No leads in the selected range', 0]])
    ]
  }

  private applyJsonSheetColumnWidths(worksheet: XLSX.WorkSheet, rows: Record<string, any>[]) {
    const headers = rows.length > 0 ? Object.keys(rows[0]) : []

    worksheet['!cols'] = headers.map(header => {
      const valueWidth = rows.reduce((max, row) => {
        const cellValue = String(row[header] ?? '')
        const lineWidth = cellValue.split(/\r?\n/).reduce((lineMax, line) => {
          return Math.max(lineMax, line.length)
        }, 0)

        return Math.max(max, lineWidth)
      }, header.length)

      return {
        wch: Math.max(12, Math.min(56, valueWidth + 2))
      }
    })
  }

  private applyAoaSheetColumnWidths(
    worksheet: XLSX.WorkSheet,
    rows: Array<Array<string | number>>
  ) {
    const widths: number[] = []

    rows.forEach(row => {
      row.forEach((value, index) => {
        const nextWidth = String(value ?? '').length + 2
        widths[index] = Math.max(widths[index] || 12, Math.min(56, nextWidth))
      })
    })

    worksheet['!cols'] = widths.map(width => ({
      wch: Math.max(12, width)
    }))
  }
}
