import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { InjectConnection } from '@nestjs/mongoose'
import { Connection } from 'mongoose'

import { RedisService } from '@service'

const STARTUP_READINESS_GRACE_PERIOD_MS = process.env.NODE_ENV === 'production' ? 10 * 60 * 1000 : 0
const REDIS_HEALTHCHECK_TIMEOUT_MS = 1000

interface HealthResponse {
  status: 'ok' | 'down'
  service: 'heyform-server'
  timestamp: string
  uptime: number
}

interface ReadinessResponse extends HealthResponse {
  checks: {
    mongo: 'up' | 'down'
    redis: 'up' | 'down'
  }
  startupGracePeriodActive?: boolean
}

@Controller()
export class HealthController {
  constructor(
    private readonly redisService: RedisService,
    @InjectConnection() private readonly mongoConnection: Connection
  ) {}

  @Get('/health')
  index(): HealthResponse {
    return {
      status: 'ok',
      service: 'heyform-server',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime())
    }
  }

  @Get('/health/ready')
  async ready(): Promise<ReadinessResponse> {
    let mongo: 'up' | 'down' = 'down'
    let redis: 'up' | 'down' = 'down'
    const withinStartupGracePeriod =
      STARTUP_READINESS_GRACE_PERIOD_MS > 0 &&
      process.uptime() * 1000 < STARTUP_READINESS_GRACE_PERIOD_MS

    if (this.mongoConnection.readyState === 1) {
      mongo = 'up'
    }

    if (this.redisService.status() === 'ready') {
      try {
        const pong = await Promise.race([
          this.redisService.ping(),
          new Promise<null>(resolve => {
            const timer = setTimeout(() => resolve(null), REDIS_HEALTHCHECK_TIMEOUT_MS)
            timer.unref?.()
          })
        ])

        if (pong === 'PONG') {
          redis = 'up'
        }
      } catch (_) {}
    }

    const isReady = (mongo === 'up' && redis === 'up') || withinStartupGracePeriod

    const response: ReadinessResponse = {
      status: isReady ? 'ok' : 'down',
      service: 'heyform-server',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      checks: {
        mongo,
        redis
      }
    }

    if (withinStartupGracePeriod && (mongo === 'down' || redis === 'down')) {
      response.startupGracePeriodActive = true
    }

    if (!isReady) {
      throw new ServiceUnavailableException(response)
    }

    return response
  }
}
