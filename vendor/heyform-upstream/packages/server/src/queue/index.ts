import { BullModule, BullModuleOptions } from '@nestjs/bull'

import { BullOptionsFactory } from '@config'

import { FormReportQueue } from './form-report.queue'
import { IntegrationQueue } from './integration-queue'
import { MailQueue } from './mail.queue'
import { SubmissionNotificationQueue } from './submission-notification.queue'
import { TranslateFormQueue } from './translate-form.queue'

const MAIL_QUEUE_TIMEOUT_MS = 5 * 60 * 1000

async function getQueueOptions(queueName: string): Promise<BullModuleOptions> {
  const options = await BullOptionsFactory()

  if (queueName !== 'MailQueue') {
    return options
  }

  return {
    ...options,
    defaultJobOptions: {
      ...(options.defaultJobOptions ?? {}),
      timeout: MAIL_QUEUE_TIMEOUT_MS
    }
  }
}

export const QueueProviders = {
  FormReportQueue,
  MailQueue,
  TranslateFormQueue,
  IntegrationQueue,
  SubmissionNotificationQueue
}

export const QueueModules = Object.keys(QueueProviders).map(queueName => {
  return BullModule.registerQueueAsync({
    name: queueName,
    useFactory: () => getQueueOptions(queueName)
  })
})
