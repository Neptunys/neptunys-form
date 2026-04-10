import { BadRequestException, Controller, Get, Query, Res } from '@nestjs/common'
import { Response } from 'express'

import { Auth, FormGuard } from '@decorator'
import { ExportSubmissionsDto } from '@dto'
import { flattenFields } from '@heyform-inc/answer-utils'
import { date } from '@heyform-inc/utils'
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
}
