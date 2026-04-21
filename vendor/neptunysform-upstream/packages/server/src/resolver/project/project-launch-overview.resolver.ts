import { Auth, Project, ProjectGuard } from '@decorator'
import { ProjectDetailInput, ProjectLaunchOverviewType } from '@graphql'
import { FormStatusEnum } from '@neptunysform-inc/shared-types-enums'
import { date, timestamp } from '@neptunysform-inc/utils'
import { ExperimentStatusEnum, ProjectModel } from '@model'
import { Args, Query, Resolver } from '@nestjs/graphql'
import { ExperimentService, FormService, SubmissionService } from '@service'
import { buildLeadCapturePayload } from '@utils'

@Resolver()
@Auth()
export class ProjectLaunchOverviewResolver {
  constructor(
    private readonly formService: FormService,
    private readonly experimentService: ExperimentService,
    private readonly submissionService: SubmissionService
  ) {}

  @ProjectGuard()
  @Query(returns => ProjectLaunchOverviewType)
  async projectLaunchOverview(
    @Project() project: ProjectModel,
    @Args('input') input: ProjectDetailInput
  ): Promise<ProjectLaunchOverviewType> {
    const [forms, experiments] = await Promise.all([
      this.formService.findAll(input.projectId, FormStatusEnum.NORMAL),
      this.experimentService.findAllInProject(input.projectId)
    ])

    const formIds = forms.map(form => form.id)
    const submissions = await this.submissionService.findAllInFormsByDateRange(
      formIds,
      date().subtract(30, 'days').unix(),
      timestamp()
    )
    const formMap = new Map(forms.map(form => [form.id, form]))
    const leads = submissions
      .map(submission => {
        const form = formMap.get(submission.formId)

        return form ? buildLeadCapturePayload(form, submission) : undefined
      })
      .filter(Boolean)

    return {
      projectId: project.id,
      formCount: forms.length,
      publishedFormCount: forms.filter(form => !form.suspended && form.settings?.active).length,
      experimentCount: experiments.length,
      runningExperimentCount: experiments.filter(
        experiment => experiment.status === ExperimentStatusEnum.RUNNING
      ).length,
      leadCount30d: submissions.length,
      highPriorityLeadCount30d: leads.filter(lead => lead?.leadLevel === 'high').length,
      lastLeadAt: submissions[0]?.endAt
    }
  }
}