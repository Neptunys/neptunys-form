import { BadRequestException } from '@nestjs/common'

import { Auth, Project, ProjectGuard } from '@decorator'
import {
  CreateExperimentInput,
  ExperimentType,
  ProjectDetailInput,
  ProjectExperimentInput,
  PublicExperimentInput,
  PublicExperimentType,
  UpdateExperimentInput
} from '@graphql'
import { ExperimentModel, ProjectModel } from '@model'
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql'
import { ExperimentService } from '@service'

@Resolver()
export class PublicExperimentResolver {
  constructor(private readonly experimentService: ExperimentService) {}

  @Query(returns => PublicExperimentType)
  async publicExperiment(
    @Context() context: any,
    @Args('input') input: PublicExperimentInput
  ): Promise<PublicExperimentType> {
    const anonymousId = context?.req?.get('x-anonymous-id')
    return this.experimentService.resolvePublicExperiment(input.experimentId, anonymousId)
  }
}

@Resolver()
@Auth()
export class ExperimentsResolver {
  constructor(private readonly experimentService: ExperimentService) {}

  @ProjectGuard()
  @Query(returns => [ExperimentType])
  async experiments(
    @Project() project: ProjectModel,
    @Args('input') input: ProjectDetailInput
  ): Promise<ExperimentType[]> {
    const experiments = await this.experimentService.findAllInProject(input.projectId)
    return Promise.all(experiments.map(experiment => this.transformExperiment(experiment)))
  }

  @ProjectGuard()
  @Query(returns => ExperimentType)
  async experiment(
    @Project() project: ProjectModel,
    @Args('input') input: ProjectExperimentInput
  ): Promise<ExperimentType> {
    const experiment = await this.experimentService.findById(input.experimentId)

    if (!experiment || experiment.projectId !== project.id) {
      throw new BadRequestException('The experiment does not exist')
    }

    return this.transformExperiment(experiment)
  }

  @ProjectGuard()
  @Mutation(returns => String)
  async createExperiment(
    @Project() project: ProjectModel,
    @Args('input') input: CreateExperimentInput
  ): Promise<string> {
    return this.experimentService.create(project, input)
  }

  @ProjectGuard()
  @Mutation(returns => Boolean)
  async updateExperiment(
    @Project() project: ProjectModel,
    @Args('input') input: UpdateExperimentInput
  ): Promise<boolean> {
    const experiment = await this.experimentService.findById(input.experimentId)

    if (!experiment || experiment.projectId !== project.id) {
      throw new BadRequestException('The experiment does not exist')
    }

    const updates = { ...input }
    delete (updates as any).projectId
    delete (updates as any).experimentId

    return this.experimentService.update(input.experimentId, updates)
  }

  @ProjectGuard()
  @Mutation(returns => Boolean)
  async deleteExperiment(
    @Project() project: ProjectModel,
    @Args('input') input: ProjectExperimentInput
  ): Promise<boolean> {
    const experiment = await this.experimentService.findById(input.experimentId)

    if (!experiment || experiment.projectId !== project.id) {
      throw new BadRequestException('The experiment does not exist')
    }

    return this.experimentService.delete(input.experimentId)
  }

  private async transformExperiment(experiment: ExperimentModel): Promise<ExperimentType> {
    const winner = await this.experimentService.evaluateWinner(experiment)

    return {
      id: experiment.id,
      teamId: experiment.teamId,
      projectId: experiment.projectId,
      name: experiment.name,
      status: experiment.status,
      primaryMetric: experiment.primaryMetric,
      variants: experiment.variants,
      autoPromote: experiment.autoPromote,
      durationHours: experiment.durationHours,
      minimumSampleSize: experiment.minimumSampleSize,
      startAt: experiment.startAt,
      endAt: experiment.endAt,
      winnerFormId: experiment.winnerFormId || winner.winnerFormId,
      promotedAt: experiment.promotedAt,
      minimumSampleReached: winner.minimumSampleReached,
      promotionBlockedReason: winner.promotionBlockedReason,
      metrics: winner.metrics
    }
  }
}