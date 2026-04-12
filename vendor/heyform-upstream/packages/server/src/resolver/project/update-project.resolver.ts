import { Auth, Project, ProjectGuard } from '@decorator'
import { UpdateProjectInput } from '@graphql'
import { ProjectModel } from '@model'
import { helper } from '@heyform-inc/utils'
import { Args, Mutation, Resolver } from '@nestjs/graphql'
import { ProjectService } from '@service'

@Resolver()
@Auth()
export class UpdateProjectResolver {
  constructor(private readonly projectService: ProjectService) {}

  @ProjectGuard()
  @Mutation(returns => Boolean)
  async updateProject(
    @Project() project: ProjectModel,
    @Args('input') input: UpdateProjectInput
  ): Promise<boolean> {
    const updates: Record<string, any> = {}

    if (Object.prototype.hasOwnProperty.call(input, 'launchMode')) {
      updates.launchMode = input.launchMode
    }

    if (Object.prototype.hasOwnProperty.call(input, 'launchFormId')) {
      updates.launchFormId = helper.isValid(input.launchFormId) ? input.launchFormId : null
    }

    if (Object.prototype.hasOwnProperty.call(input, 'launchExperimentId')) {
      updates.launchExperimentId = helper.isValid(input.launchExperimentId)
        ? input.launchExperimentId
        : null
    }

    if (Object.prototype.hasOwnProperty.call(input, 'leadNotificationEmails')) {
      updates.leadNotificationEmails = helper.isArray(input.leadNotificationEmails)
        ? input.leadNotificationEmails
        : null
    }

    if (Object.prototype.hasOwnProperty.call(input, 'enableLeadReport')) {
      updates.enableLeadReport = input.enableLeadReport
    }

    if (Object.prototype.hasOwnProperty.call(input, 'leadReportRangeDays')) {
      updates.leadReportRangeDays = input.leadReportRangeDays
    }

    if (Object.prototype.hasOwnProperty.call(input, 'reportingTimezone')) {
      updates.reportingTimezone = helper.isValid(input.reportingTimezone)
        ? input.reportingTimezone
        : null
    }

    const tasks = [] as Array<Promise<boolean>>

    if (Object.keys(updates).length > 0) {
      tasks.push(
        this.projectService.update(project.id, {
          $set: updates
        })
      )
    }

    if (Object.prototype.hasOwnProperty.call(input, 'launchPath')) {
      tasks.push(this.projectService.updateLaunchPath(project, input.launchPath))
    }

    if (tasks.length < 1) {
      return true
    }

    const results = await Promise.all(tasks)
    return results.every(Boolean)
  }
}