import {
  Answer,
  FieldKindEnum,
  FormField,
  HiddenField,
  STATEMENT_FIELD_KINDS
} from '@heyform-inc/shared-types-enums'
import { Injectable } from '@nestjs/common'
import { parseAsync } from 'json2csv'
import * as XLSX from 'xlsx'

import { htmlUtils, parsePlainAnswer } from '@heyform-inc/answer-utils'
import { helper, unixDate } from '@heyform-inc/utils'
import { FormModel, ProjectModel, SubmissionModel } from '@model'
import { buildLeadCapturePayload } from '@utils'

const FIELD_ID_KEY = '#'
const START_DATE_KEY = 'Start Date (UTC)'
const SUBMIT_DATE_KEY = 'Submit Date (UTC)'

interface ExportDataset {
  fields: string[]
  records: Record<string, any>[]
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
    const worksheet = XLSX.utils.json_to_sheet(records)

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

      return {
        Form: form.name,
        'Form ID': form.id,
        Status: form.settings?.active && !form.suspended ? 'Published' : 'Inactive',
        'Leads in Range': stats?.leadCount || 0,
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
        'Respondent Name': lead.respondentName || '',
        'Respondent Email': lead.respondentEmail || '',
        'Respondent Phone': lead.respondentPhone || '',
        'Lead Score': helper.isNil(lead.leadScore) ? '' : lead.leadScore,
        'Lead Level': lead.leadLevel || '',
        'Lead Quality': lead.leadQuality || '',
        'Lead Priority': lead.leadPriority || '',
        'Answer Summary': lead.answersPlain
      }

      answerColumns.forEach(column => {
        row[`Answer: ${column}`] = lead.answersByTitle[column] || ''
      })

      hiddenFieldColumns.forEach(column => {
        row[`Hidden: ${column}`] = lead.hiddenFieldsByName[column] || ''
      })

      variableColumns.forEach(column => {
        row[`Variable: ${column}`] = helper.isNil(lead.variablesByName[column])
          ? ''
          : lead.variablesByName[column]
      })

      return row
    })

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(
        this.buildProjectSummaryRows(project, options, leads, formRows)
      ),
      'Summary'
    )
    XLSX.utils.book_append_sheet(
      workbook,
      this.jsonToSheet(formRows, 'No forms were found for this project.'),
      'Forms'
    )
    XLSX.utils.book_append_sheet(
      workbook,
      this.jsonToSheet(leadRows, 'No leads were found for the selected date range.'),
      'Leads'
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
      FIELD_ID_KEY,
      ...selectedFormFields.map(field => field.title),
      ...selectedHiddenFields.map(hiddenField => hiddenField.name),
      ...variableNames.map(name => `Variable: ${name}`),
      START_DATE_KEY,
      SUBMIT_DATE_KEY
    ]

    for (const submission of submissions) {
      const record: Record<string, any> = {
        [FIELD_ID_KEY]: submission.id
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

        record[selectedHiddenField.name] = hiddenFieldValue
      }

      for (const variableName of variableNames) {
        const variableValue = submission.variables.find(variable => variable.name === variableName)?.value

        record[`Variable: ${variableName}`] = helper.isNil(variableValue) ? '' : variableValue
      }

      record[START_DATE_KEY] = submission.startAt ? unixDate(submission.startAt!).toISOString() : ''
      record[SUBMIT_DATE_KEY] = submission.startAt ? unixDate(submission.endAt!).toISOString() : ''

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
    return XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Notice: emptyMessage }])
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

    return [
      ['Project report'],
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
      ['High priority leads', highPriorityLeads],
      ['First lead at (UTC)', earliestLead?.submittedAtIso || ''],
      ['Last lead at (UTC)', latestLead?.submittedAtIso || ''],
      [],
      ['Top forms', 'Leads'],
      ...(topForms.length > 0
        ? topForms.map(row => [row.Form, row['Leads in Range']])
        : [['No leads in the selected range', 0]])
    ]
  }
}
