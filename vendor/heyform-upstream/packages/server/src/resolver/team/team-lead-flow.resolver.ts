import { Auth, Team, TeamGuard } from '@decorator'
import { TeamDetailInput, TeamLeadFlowType } from '@graphql'
import { TeamModel } from '@model'
import { Args, Query, Resolver } from '@nestjs/graphql'

@Resolver()
@Auth()
export class TeamLeadFlowResolver {
  @Query(returns => TeamLeadFlowType)
  @TeamGuard()
  async teamLeadFlow(
    @Team() team: TeamModel,
    @Args('input') input: TeamDetailInput
  ): Promise<TeamLeadFlowType> {
    return {
      clientName: team.clientName,
      leadNotificationEmails: team.leadNotificationEmails,
      enableLeadReport: team.enableLeadReport,
      leadReportRangeDays: team.leadReportRangeDays,
      leadReportLastSentAt: team.leadReportLastSentAt,
      reportingTimezone: team.reportingTimezone,
      enableGoogleSheetsLeadSync: team.enableGoogleSheetsLeadSync,
      googleSheetsLeadConfig: team.googleSheetsLeadConfig,
      googleSheetsLeadLastDeliveryAt: team.googleSheetsLeadLastDeliveryAt,
      googleSheetsLeadLastDeliveryStatus: team.googleSheetsLeadLastDeliveryStatus,
      googleSheetsLeadLastDeliveryMessage: team.googleSheetsLeadLastDeliveryMessage
    }
  }
}