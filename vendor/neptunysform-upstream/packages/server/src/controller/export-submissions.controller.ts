import { BadRequestException, Controller, Get, Query, Res } from '@nestjs/common'
import { Response } from 'express'

import { Auth, FormGuard, Project, ProjectGuard } from '@decorator'
import {
  ExportFormAnalyticsDto,
  ExportProjectReportDto,
  ExportSubmissionsDto
} from '@dto'
import { flattenFields, htmlUtils } from '@neptunysform-inc/answer-utils'
import { FormStatusEnum, QUESTION_FIELD_KINDS } from '@neptunysform-inc/shared-types-enums'
import { date, helper } from '@neptunysform-inc/utils'
import { FormAnalyticRangeEnum, ProjectModel } from '@model'
import { ExportFileService, FormAnalyticService, FormService, SubmissionService } from '@service'

function sanitizeFilenamePart(value: string | undefined, fallback: string) {
  const normalized = (value || '')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')

  return normalized || fallback
}

function buildContentDisposition(filename: string) {
  const quotedFilename = filename.replace(/["\\]/g, '')
  const encodedFilename = encodeURIComponent(filename)

  return `attachment; filename="${quotedFilename}"; filename*=UTF-8''${encodedFilename}`
}

function buildAnalyticsRangeLabel(input: ExportFormAnalyticsDto) {
  if (input.range === FormAnalyticRangeEnum.CUSTOM && input.startDate && input.endDate) {
    return `${input.startDate}-to-${input.endDate}`
  }

  return input.range
}

@Controller()
@Auth()
export class ExportSubmissionsController {
  constructor(
    private readonly submissionService: SubmissionService,
    private readonly formService: FormService,
    private readonly exportFileService: ExportFileService,
    private readonly formAnalyticService: FormAnalyticService
  ) {}

  @Get('/api/export/submissions')
  @FormGuard()
  async exportSubmissions(
    @Query() input: ExportSubmissionsDto,
    @Res() res: Response
  ): Promise<void> {
    const form = await this.formService.findById(input.formId)
    if (!form) {
      throw new BadRequestException('The form does not exist')
    }

    const submissions = await this.submissionService.findAllByForm(input.formId)
    if (submissions.length < 1) {
      throw new BadRequestException('The submissions does not exist')
    }

    const format = input.format || 'csv'
    const fields = flattenFields(form.fields)
    const dateStr = date().format('YYYY-MM-DD')
    const filename = `${sanitizeFilenamePart(form.name, 'form-submissions')}-${dateStr}.${format}`

    const data =
      format === 'xlsx'
        ? await this.exportFileService.xlsx(fields, form.hiddenFields, submissions)
        : await this.exportFileService.csv(fields, form.hiddenFields, submissions)

    res.header('Content-Disposition', buildContentDisposition(filename))
    if (format === 'xlsx') {
      res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    } else {
      res.type('text/csv; charset=utf-8')
    }
    res.send(data)
  }

  @Get('/api/export/project-report')
  @ProjectGuard()
  async exportProjectReport(
    @Project() project: ProjectModel,
    @Query() input: ExportProjectReportDto,
    @Res() res: Response
  ): Promise<void> {
    const { startAt, endAt } = this.resolveDateRange(input.startDate, input.endDate)
    const forms = await this.formService.findAll(project.id, FormStatusEnum.NORMAL)
    const submissions = await this.submissionService.findAllInFormsByDateRange(
      forms.map(form => form.id),
      startAt,
      endAt
    )
    const filename = `${sanitizeFilenamePart(project.name, 'project')}-client-report-${input.startDate}-to-${input.endDate}.xlsx`
    const data = await this.exportFileService.projectReportXlsx(project, forms, submissions, {
      startDate: input.startDate,
      endDate: input.endDate
    })

    res.header('Content-Disposition', buildContentDisposition(filename))
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.send(data)
  }

  @Get('/api/export/form-analytics')
  @FormGuard()
  async exportFormAnalytics(
    @Query() input: ExportFormAnalyticsDto,
    @Res() res: Response
  ): Promise<void> {
    const form = await this.formService.findById(input.formId)

    if (!form) {
      throw new BadRequestException('The form does not exist')
    }

    const { startAt, endAt } = this.resolveAnalyticRange(input)
    const questionSeeds = flattenFields(form.fields || [])
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
    const [summary, questions] = await Promise.all([
      this.formAnalyticService.summary({
        formId: input.formId,
        startAt,
        endAt,
        isNext: true,
        sourceChannel: input.sourceChannel,
        dedupeByIp: input.dedupeByIp,
        analyticsResetAt: form.settings?.analyticsResetAt
      }),
      this.formAnalyticService.questionAnalytics(input.formId, startAt, endAt, questionSeeds, {
        sourceChannel: input.sourceChannel,
        dedupeByIp: input.dedupeByIp,
        analyticsResetAt: form.settings?.analyticsResetAt
      })
    ])
    const filename = `${sanitizeFilenamePart(form.name, 'form')}-analytics-${buildAnalyticsRangeLabel(input)}.xlsx`
    const data = await this.exportFileService.formAnalyticsXlsx(
      {
        id: form.id,
        name: form.name
      },
      {
        range: input.range,
        startDate: input.startDate,
        endDate: input.endDate,
        sourceChannel: input.sourceChannel,
        dedupeByIp: input.dedupeByIp,
        startAt,
        endAt,
        summary,
        questions
      }
    )

    res.header('Content-Disposition', buildContentDisposition(filename))
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.send(data)
  }

  private resolveDateRange(startDate: string, endDate: string) {
    const startAt = this.parseDateBoundary(startDate, false)
    const endAt = this.parseDateBoundary(endDate, true)

    if (startAt > endAt) {
      throw new BadRequestException('Start date must be on or before end date')
    }

    return {
      startAt,
      endAt
    }
  }

  private resolveAnalyticRange(input: ExportFormAnalyticsDto) {
    const now = date()
    let startAt = now.startOf('day')
    let endAt = now.endOf('day')

    switch (input.range) {
      case FormAnalyticRangeEnum.TODAY:
        break

      case FormAnalyticRangeEnum.WEEK:
        startAt = now.subtract(7, 'days').startOf('day')
        endAt = now.endOf('day')
        break

      case FormAnalyticRangeEnum.MONTH:
        startAt = now.subtract(1, 'months').startOf('day')
        endAt = now.endOf('day')
        break

      case FormAnalyticRangeEnum.THREE_MONTH:
        startAt = now.subtract(3, 'months').startOf('day')
        endAt = now.endOf('day')
        break

      case FormAnalyticRangeEnum.SIX_MONTH:
        startAt = now.subtract(6, 'months').startOf('day')
        endAt = now.endOf('day')
        break

      case FormAnalyticRangeEnum.YEAR:
        startAt = now.subtract(1, 'years').startOf('day')
        endAt = now.endOf('day')
        break

      case FormAnalyticRangeEnum.CUSTOM: {
        if (!input.startDate || !input.endDate) {
          throw new BadRequestException('Custom analytics exports require both startDate and endDate')
        }

        const rawStart = date(input.startDate)
        const rawEnd = date(input.endDate)
        const normalizedStart = rawEnd.isBefore(rawStart)
          ? rawEnd.startOf('day')
          : rawStart.startOf('day')
        const normalizedEnd = rawEnd.isBefore(rawStart)
          ? rawStart.endOf('day')
          : rawEnd.endOf('day')

        startAt = normalizedStart
        endAt = normalizedEnd
        break
      }
    }

    return {
      startAt: startAt.toDate(),
      endAt: endAt.toDate()
    }
  }

  private parseDateBoundary(value: string, endOfDay: boolean) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException('Dates must use YYYY-MM-DD format')
    }

    const parsed = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid date range provided')
    }

    return Math.floor(parsed.getTime() / 1000)
  }
}
