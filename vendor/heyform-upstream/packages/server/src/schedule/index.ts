import { BullModule } from '@nestjs/bull'

import { DeleteFormInTrashSchedule } from './delete-form-in-trash.schedule'
import { DeleteUserAccountSchedule } from './delete-user-account.schedule'
import { FinalizeExperimentSchedule } from './finalize-experiment.schedule'
import { LeadReportSchedule } from './lead-report.schedule'
import { ResetInviteCodeSchedule } from './reset-invite-code.schedule'
import { BullOptionsFactory } from '@config'

export const ScheduleProviders = {
  DeleteFormInTrashSchedule,
  FinalizeExperimentSchedule,
  LeadReportSchedule,
  ResetInviteCodeSchedule,
  DeleteUserAccountSchedule
}

export const ScheduleModules = Object.keys(ScheduleProviders).map(scheduleName => {
  return BullModule.registerQueueAsync({
    name: scheduleName,
    useFactory: BullOptionsFactory
  })
})
