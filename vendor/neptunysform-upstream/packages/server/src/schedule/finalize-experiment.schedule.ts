import { Process, Processor } from '@nestjs/bull'

import { ExperimentService } from '@service'

import { BaseQueue } from '../queue/base.queue'

@Processor('FinalizeExperimentSchedule')
export class FinalizeExperimentSchedule extends BaseQueue {
  constructor(private readonly experimentService: ExperimentService) {
    super()
  }

  @Process()
  async finalizeExperiments(): Promise<void> {
    await this.experimentService.finalizeDueExperiments()
  }
}