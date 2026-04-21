import { BadRequestException } from '@nestjs/common'

import { Auth, Team, TeamGuard } from '@decorator'
import { SendTeamLeadReportInput } from '@graphql'
import { helper } from '@neptunysform-inc/utils'
import { TeamModel } from '@model'
import { Args, Mutation, Resolver } from '@nestjs/graphql'

import { LeadReportSchedule } from '../../schedule/lead-report.schedule'

@Resolver()
@Auth()
export class SendTeamLeadReportResolver {
  constructor(private readonly leadReportSchedule: LeadReportSchedule) {}

  @Mutation(returns => Boolean)
  @TeamGuard()
  async sendTeamLeadReport(
    @Team() team: TeamModel,
    @Args('input') input: SendTeamLeadReportInput
  ): Promise<boolean> {
    if (!team.isOwner) {
      throw new BadRequestException("You don't have permission to send workspace lead reports")
    }

    const settingsOverride = helper.isObject(input.settingsOverride)
      ? input.settingsOverride
      : undefined

    await this.leadReportSchedule.sendWorkspaceLeadReport(team, {
      persistLastSentAt: false,
      skipScheduleCheck: true,
      requireRecipients: true,
      settingsOverride
    })

    return true
  }
}
