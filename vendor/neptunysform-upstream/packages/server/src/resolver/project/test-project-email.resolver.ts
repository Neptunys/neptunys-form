import { BadRequestException } from '@nestjs/common'

import { Auth, Project, ProjectGuard } from '@decorator'
import { SendProjectEmailTestInput } from '@graphql'
import { helper } from '@neptunysform-inc/utils'
import { ProjectModel } from '@model'
import { Args, Mutation, Resolver } from '@nestjs/graphql'
import { ProjectEmailService, TeamService } from '@service'

@Resolver()
@Auth()
export class TestProjectEmailResolver {
  constructor(
    private readonly projectEmailService: ProjectEmailService,
    private readonly teamService: TeamService
  ) {}

  @Mutation(returns => Boolean)
  @ProjectGuard()
  async testProjectEmail(
    @Project() project: ProjectModel,
    @Args('input') input: SendProjectEmailTestInput
  ): Promise<boolean> {
    const team = await this.teamService.findById(project.teamId)

    if (!team) {
      throw new BadRequestException('Workspace context is unavailable for this project')
    }

    const settingsOverride = helper.isObject(input.settingsOverride)
      ? input.settingsOverride
      : undefined

    if (input.emailType === 'confirmation' || input.emailType === 'negative_confirmation') {
      await this.projectEmailService.sendProjectRespondentTestEmail(
        project,
        team,
        input.recipientEmail,
        {
          settingsOverride,
          simulateNegativeResult: input.emailType === 'negative_confirmation'
        }
      )

      return true
    }

    if (input.emailType === 'recap') {
      await this.projectEmailService.sendProjectLeadReport(project, team, {
        recipientsOverride: [input.recipientEmail],
        persistLastSentAt: false,
        skipScheduleCheck: true,
        settingsOverride
      })

      return true
    }

    throw new BadRequestException('Unsupported project email test type')
  }
}