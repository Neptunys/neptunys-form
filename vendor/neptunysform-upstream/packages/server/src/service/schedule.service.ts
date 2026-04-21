import { InjectQueue } from '@nestjs/bull'
import { Injectable, OnApplicationBootstrap } from '@nestjs/common'
import { Queue } from 'bull'

@Injectable()
export class ScheduleService implements OnApplicationBootstrap {
  constructor(
    @InjectQueue('DeleteFormInTrashSchedule')
    private readonly deleteFormInTrashSchedule: Queue,
    @InjectQueue('FinalizeExperimentSchedule')
    private readonly finalizeExperimentSchedule: Queue,
    @InjectQueue('LeadReportSchedule')
    private readonly leadReportSchedule: Queue,
    @InjectQueue('ResetInviteCodeSchedule')
    private readonly resetInviteCodeSchedule: Queue,
    @InjectQueue('DeleteUserAccountSchedule')
    private readonly deleteUserAccountSchedule: Queue
  ) {}
  async onApplicationBootstrap(): Promise<any> {
    await Promise.all([
      this.deleteFormInTrashSchedule.add(null, {
        repeat: {
          cron: '0 0 * * * *'
        }
      }),
      this.finalizeExperimentSchedule.add(null, {
        repeat: {
          cron: '0 * * * * *'
        }
      }),
      this.leadReportSchedule.add(null, {
        repeat: {
          cron: '0 5 * * * *'
        }
      }),
      this.resetInviteCodeSchedule.add(null, {
        repeat: {
          cron: '0 0 1 * * *'
        }
      }),
      this.deleteUserAccountSchedule.add(null, {
        repeat: {
          cron: '0 0 */1 * * *'
        }
      })
    ])
  }
}
