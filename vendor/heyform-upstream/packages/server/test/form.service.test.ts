import * as assert from 'assert'

import { FormStatusEnum } from '@heyform-inc/shared-types-enums'

import { FormService } from '../src/service/form.service'

function createService() {
  let findConditions: Record<string, any> | undefined
  let updateArgs:
    | {
        filter: Record<string, any>
        updates: Record<string, any>
      }
    | undefined
  let deleteConditions: Record<string, any> | undefined

  const formModel = {
    find: (conditions: Record<string, any>) => {
      findConditions = conditions

      return {
        sort: () => []
      }
    },
    updateOne: async (filter: Record<string, any>, updates: Record<string, any>) => {
      updateArgs = {
        filter,
        updates
      }

      return {
        acknowledged: true
      }
    },
    updateMany: async (filter: Record<string, any>, updates: Record<string, any>) => {
      updateArgs = {
        filter,
        updates
      }

      return {
        acknowledged: true
      }
    },
    deleteOne: async (conditions: Record<string, any>) => {
      deleteConditions = conditions

      return {
        deletedCount: 1
      }
    },
    deleteMany: async (conditions: Record<string, any>) => {
      deleteConditions = conditions

      return {
        deletedCount: 1
      }
    }
  }

  return {
    service: new FormService(formModel as any, {} as any, {} as any, {} as any),
    getFindConditions: () => findConditions,
    getUpdateArgs: () => updateArgs,
    getDeleteConditions: () => deleteConditions
  }
}

function assertStatusFilter(filter: any, normalizedStatus: string, numericStatus: number) {
  assert.deepStrictEqual(filter, {
    $in: [normalizedStatus, numericStatus, String(numericStatus)]
  })
}

async function testFindAllAcceptsLegacyTrashStatuses() {
  const { service, getFindConditions } = createService()

  await service.findAll('project_1', FormStatusEnum.TRASH)

  assertStatusFilter(getFindConditions()?.status, 'TRASH', FormStatusEnum.TRASH)
}

async function testUpdateNormalizesStatusWrites() {
  const { service, getUpdateArgs } = createService()

  await service.update('form_1', {
    retentionAt: -1,
    status: FormStatusEnum.NORMAL
  })

  assert.strictEqual(getUpdateArgs()?.updates.status, 'NORMAL')
}

async function testDeleteMatchesLegacyTrashStatuses() {
  const { service, getDeleteConditions } = createService()

  await service.delete('form_1')

  assertStatusFilter(getDeleteConditions()?.status, 'TRASH', FormStatusEnum.TRASH)
}

async function run() {
  await testFindAllAcceptsLegacyTrashStatuses()
  await testUpdateNormalizesStatusWrites()
  await testDeleteMatchesLegacyTrashStatuses()
}

if (require.main === module) {
  run().catch(error => {
    // eslint-disable-next-line no-console
    console.error(error)
    process.exitCode = 1
  })
}