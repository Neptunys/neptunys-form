import { BadRequestException } from '@nestjs/common'

import { Auth, Team, TeamGuard } from '@decorator'
import { UpdateTeamInput } from '@graphql'
import { helper, pickValidValues } from '@heyform-inc/utils'
import { TeamModel } from '@model'
import { Args, Mutation, Resolver } from '@nestjs/graphql'
import { TeamService } from '@service'

@Resolver()
@Auth()
export class UpdateTeamResolver {
  constructor(private readonly teamService: TeamService) {}

  @Mutation(returns => Boolean)
  @TeamGuard()
  async updateTeam(
    @Team() team: TeamModel,
    @Args('input') input: UpdateTeamInput
  ): Promise<boolean> {
    if (!team.isOwner) {
      throw new BadRequestException("You don't have permission to change the workspace settings")
    }

    const updates: Record<string, any> = pickValidValues(input as any, [
      'name',
      'avatar',
      'clientName',
      'enableLeadReport',
      'leadReportRangeDays',
      'reportingTimezone'
    ])

    if (!helper.isNil(input.removeBranding)) {
      updates.removeBranding = input.removeBranding
    }

    if (Object.prototype.hasOwnProperty.call(input, 'leadNotificationEmails')) {
      updates.leadNotificationEmails = helper.isArray(input.leadNotificationEmails)
        ? input.leadNotificationEmails
        : []
    }

    if (!helper.isNil(input.enableGoogleSheetsLeadSync)) {
      updates.enableGoogleSheetsLeadSync = input.enableGoogleSheetsLeadSync
    }

    if (Object.prototype.hasOwnProperty.call(input, 'googleSheetsLeadConfig')) {
      updates.googleSheetsLeadConfig = helper.isObject(input.googleSheetsLeadConfig)
        ? input.googleSheetsLeadConfig
        : {}
    }

    return await this.teamService.update(input.teamId, updates)
  }
}
