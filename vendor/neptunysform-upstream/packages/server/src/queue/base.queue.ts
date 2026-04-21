import { OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull'
import { Job } from 'bull'

import { Logger } from '@utils'

export interface IntegrationQueueJob {
  formId: string
  integrationId: string
  submissionId: string
}

export class BaseQueue {
  logger!: Logger

  constructor() {
    this.logger = new Logger('Queue')
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.info(`${job.queue.name}#${job.id} started`)
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.logger.info(`${job.queue.name}#${job.id} completed`)
  }

  @OnQueueFailed()
  async onFailed(job: Job) {
    const attempts = job.opts.attempts || 1
    const reason = job.failedReason ? `, reason: ${job.failedReason}` : ''
    this.logger.error(
      `${job.queue.name}#${job.id} failed, attempts ${job.attemptsMade} of ${attempts} times${reason}`
    )

    if (job.attemptsMade >= attempts) {
      await job.discard()
    }
  }
}
