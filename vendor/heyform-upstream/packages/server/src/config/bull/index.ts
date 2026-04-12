import { BullModuleOptions } from '@nestjs/bull'
import IORedis, { Redis, RedisOptions } from 'ioredis'

import {
  BULL_JOB_ATTEMPTS,
  BULL_JOB_BACKOFF_DELAY,
  BULL_JOB_BACKOFF_TYPE,
  BULL_JOB_TIMEOUT,
  REDIS_DB,
  REDIS_HOST,
  REDIS_PASSWORD,
  REDIS_PORT,
  REDIS_TLS,
  REDIS_USERNAME
} from '@environments'
import { ms } from '@heyform-inc/utils'

type BullRedisClientType = 'client' | 'subscriber' | 'bclient'

const bullRedisConfig: RedisOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  username: REDIS_USERNAME,
  password: REDIS_PASSWORD,
  db: REDIS_DB + 1,
  ...(REDIS_TLS ? { tls: {} } : {})
}

const sharedBullClients = new Map<Exclude<BullRedisClientType, 'bclient'>, Redis>()

function createBullClient(type: BullRedisClientType, redisOptions?: RedisOptions): Redis {
  if (type === 'bclient') {
    return new IORedis({
      ...bullRedisConfig,
      ...redisOptions
    })
  }

  const sharedClient = sharedBullClients.get(type)

  if (sharedClient) {
    return sharedClient
  }

  const client = new IORedis({
    ...bullRedisConfig,
    ...redisOptions
  })

  sharedBullClients.set(type, client)

  return client
}

export const BullOptionsFactory = (): BullModuleOptions | Promise<BullModuleOptions> => ({
  createClient: createBullClient,
  redis: bullRedisConfig,
  defaultJobOptions: {
    attempts: BULL_JOB_ATTEMPTS,
    timeout: ms(BULL_JOB_TIMEOUT),
    removeOnComplete: true,
    removeOnFail: false,
    backoff: {
      delay: BULL_JOB_BACKOFF_DELAY,
      type: BULL_JOB_BACKOFF_TYPE
    }
  }
})
