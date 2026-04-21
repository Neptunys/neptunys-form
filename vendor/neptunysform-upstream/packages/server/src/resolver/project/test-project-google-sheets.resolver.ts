import { BadRequestException } from '@nestjs/common'

import { Auth, Project, ProjectGuard } from '@decorator'
import { TestProjectGoogleSheetsInput } from '@graphql'
import { FormStatusEnum } from '@neptunysform-inc/shared-types-enums'
import { helper } from '@neptunysform-inc/utils'
import { ProjectModel } from '@model'
import { Args, Mutation, Resolver } from '@nestjs/graphql'
import { AppService, FormService, TeamService } from '@service'

@Resolver()
@Auth()
export class TestProjectGoogleSheetsResolver {
  constructor(
    private readonly appService: AppService,
    private readonly formService: FormService,
    private readonly teamService: TeamService
  ) {}

  @Mutation(returns => Boolean)
  @ProjectGuard()
  async testProjectGoogleSheets(
    @Project() project: ProjectModel,
    @Args('input') input: TestProjectGoogleSheetsInput
  ): Promise<boolean> {
    const app = this.appService.findById('googlesheets')

    if (!app) {
      throw new BadRequestException('Google Sheets app is unavailable')
    }

    if (helper.isEmpty(input.googleSheetsLeadConfig)) {
      throw new BadRequestException('Invalid Google Sheets settings')
    }

    if (typeof app.test !== 'function') {
      throw new BadRequestException('Google Sheets test runs are unavailable')
    }

    const [forms, team] = await Promise.all([
      this.formService.findAll(project.id, FormStatusEnum.NORMAL),
      this.teamService.findById(project.teamId)
    ])

    const form = forms.find(item => !item.suspended)

    if (!form) {
      throw new BadRequestException('Create an active form in this project before sending a test row')
    }

    await app.test({
      config: input.googleSheetsLeadConfig,
      form,
      team: team || undefined
    })

    return true
  }
}