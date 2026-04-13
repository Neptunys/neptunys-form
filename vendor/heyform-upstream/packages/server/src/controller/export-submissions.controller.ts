import { BadRequestException, Controller, Get, Query, Res } from '@nestjs/common'
import { Response } from 'express'

import { Auth, FormGuard, Project, ProjectGuard } from '@decorator'
import { ExportProjectReportDto, ExportSubmissionsDto } from '@dto'
import { flattenFields } from '@heyform-inc/answer-utils'
import { FormStatusEnum } from '@heyform-inc/shared-types-enums'
import { date } from '@heyform-inc/utils'
import { ProjectModel } from '@model'
import { ExportFileService, FormService, SubmissionService } from '@service'

@Controller()
@Auth()
export class ExportSubmissionsController {
  constructor(
    private readonly submissionService: SubmissionService,
    private readonly formService: FormService,
    private readonly exportFileService: ExportFileService
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
    const filename = `${encodeURIComponent(form.name)}-${dateStr}.${format}`

    const data =
      format === 'xlsx'
        ? await this.exportFileService.xlsx(fields, form.hiddenFields, submissions)
        : await this.exportFileService.csv(fields, form.hiddenFields, submissions)

    res.header('Content-Disposition', `attachment; filename="${filename}"`)
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
    const filename = `${encodeURIComponent(project.name)}-report-${input.startDate}-to-${input.endDate}.xlsx`
    const data = await this.exportFileService.projectReportXlsx(project, forms, submissions, {
      startDate: input.startDate,
      endDate: input.endDate
    })

    res.header('Content-Disposition', `attachment; filename="${filename}"`)
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
