import { Process, Processor } from '@nestjs/bull'
import { Job } from 'bull'

import { MailOptionsFactory } from '@config'
import { MailOptions, SmtpMessage, sendMail, validateMailConfig } from '@utils'

import { BaseQueue } from './base.queue'

export interface MailQueueJob {
  data: SmtpMessage
}

@Processor('MailQueue')
export class MailQueue extends BaseQueue {
  private readonly options!: MailOptions

  constructor() {
    super()
    this.options = MailOptionsFactory()
  }

  @Process()
  async process(job: Job<MailQueueJob>) {
    const configError = validateMailConfig(this.options, job.data.data.from)

    if (configError) {
      throw new Error(configError)
    }

    return sendMail(this.options, job.data.data)
  }
}
