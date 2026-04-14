import { Auth, Project, ProjectGuard } from '@decorator'
import { ProjectDetailInput, ProjectLeadFlowType } from '@graphql'
import { ProjectModel } from '@model'
import { Args, Query, Resolver } from '@nestjs/graphql'

@Resolver()
@Auth()
export class ProjectLeadFlowResolver {
  @Query(returns => ProjectLeadFlowType)
  @ProjectGuard()
  async projectLeadFlow(
    @Project() project: ProjectModel,
    @Args('input') input: ProjectDetailInput
  ): Promise<ProjectLeadFlowType> {
    return {
      leadNotificationEmails: project.leadNotificationEmails,
      enableLeadReport: project.enableLeadReport,
      leadReportRangeDays: project.leadReportRangeDays,
      leadReportLastSentAt: project.leadReportLastSentAt,
      reportingTimezone: project.reportingTimezone,
      enableGoogleSheetsLeadSync: project.enableGoogleSheetsLeadSync,
      googleSheetsLeadConfig: project.googleSheetsLeadConfig,
      googleSheetsLeadLastDeliveryAt: project.googleSheetsLeadLastDeliveryAt,
      googleSheetsLeadLastDeliveryStatus: project.googleSheetsLeadLastDeliveryStatus,
      googleSheetsLeadLastDeliveryMessage: project.googleSheetsLeadLastDeliveryMessage
    }
  }
}