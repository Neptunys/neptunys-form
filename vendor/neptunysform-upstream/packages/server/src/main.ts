import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import * as bodyParser from 'body-parser'
import * as cookieParser from 'cookie-parser'
import { Request } from 'express'
import * as rateLimit from 'express-rate-limit'
import * as helmet from 'helmet'
import * as serveStatic from 'serve-static'

import {
  APP_HOMEPAGE_ORIGIN,
  APP_LISTEN_HOSTNAME,
  APP_LISTEN_PORT,
  CORS_ALLOW_ALL_ORIGINS,
  CORS_ALLOW_CREDENTIALS,
  CORS_ALLOWED_ORIGINS,
  CORS_ALLOWED_ORIGIN_REGEXES,
  GLOBAL_RATE_LIMIT_MAX,
  GLOBAL_RATE_LIMIT_WINDOW,
  HELMET_CSP_REPORT_ONLY,
  HELMET_ENABLE_CSP,
  HELMET_FRAME_ANCESTORS,
  HELMET_REFERRER_POLICY,
  NODE_ENV,
  S3_ACCESS_KEY_ID,
  S3_BUCKET,
  S3_ENDPOINT,
  S3_REGION,
  S3_SECRET_ACCESS_KEY,
  STATIC_DIR,
  UPLOAD_DIR,
  VIEW_DIR
} from '@environments'
import { helper, ms } from '@neptunysform-inc/utils'
import { Logger, hbs } from '@utils'

import { AppModule } from './app.module'
import { AllExceptionsFilter } from './common/filter'

function normalizeOrigin(value: string): string {
  return value.replace(/\/+$/, '').toLowerCase()
}

function parseOrigin(value?: string): URL | undefined {
  if (!value) {
    return undefined
  }

  try {
    return new URL(value)
  } catch (_) {
    return undefined
  }
}

function isAllowedOrigin(origin: string, request: Request): boolean {
  const parsedOrigin = parseOrigin(origin)

  if (!parsedOrigin) {
    return false
  }

  if (CORS_ALLOW_ALL_ORIGINS) {
    return true
  }

  const normalizedOrigin = normalizeOrigin(parsedOrigin.origin)
  const normalizedHost = parsedOrigin.host.toLowerCase()
  const normalizedHostname = parsedOrigin.hostname.toLowerCase()

  const requestHost = request.get('host')?.toLowerCase()
  const requestHostname = request.hostname?.toLowerCase()

  if (
    (requestHost && normalizedHost === requestHost) ||
    (requestHostname && normalizedHostname === requestHostname)
  ) {
    return true
  }

  const allowedOrigins = new Set(
    [APP_HOMEPAGE_ORIGIN, ...CORS_ALLOWED_ORIGINS].filter(Boolean).map(normalizeOrigin)
  )

  if (
    allowedOrigins.has(normalizedOrigin) ||
    allowedOrigins.has(normalizedHost) ||
    allowedOrigins.has(normalizedHostname)
  ) {
    return true
  }

  return CORS_ALLOWED_ORIGIN_REGEXES.some(
    pattern => pattern.test(parsedOrigin.origin) || pattern.test(parsedOrigin.host)
  )
}

function buildHelmetOptions(): Parameters<typeof helmet>[0] {
  if (!HELMET_ENABLE_CSP) {
    return {
      frameguard: false,
      contentSecurityPolicy: false,
      dnsPrefetchControl: { allow: false },
      referrerPolicy: {
        policy: HELMET_REFERRER_POLICY as any
      }
    }
  }

  const frameAncestors = HELMET_FRAME_ANCESTORS.length > 0 ? HELMET_FRAME_ANCESTORS : ["'self'"]

  return {
    frameguard: false,
    dnsPrefetchControl: { allow: false },
    referrerPolicy: {
      policy: HELMET_REFERRER_POLICY as any
    },
    contentSecurityPolicy: {
      reportOnly: HELMET_CSP_REPORT_ONLY,
      directives: {
        baseUri: ["'self'"],
        connectSrc: ["'self'", 'https:', 'wss:'],
        defaultSrc: ["'self'"],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
        frameAncestors,
        frameSrc: ["'self'", 'https://js.stripe.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://js.stripe.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com']
      }
    }
  }
}

function logProductionWarnings(): void {
  if (NODE_ENV !== 'production') {
    return
  }

  if (CORS_ALLOW_ALL_ORIGINS) {
    Logger.warn(
      'CORS is configured to allow all origins in production. Set CORS_ALLOW_ALL_ORIGINS=false and use CORS_ALLOWED_ORIGINS for an allowlist.',
      'Security'
    )
  }

  if (!HELMET_ENABLE_CSP) {
    Logger.warn(
      'Content-Security-Policy is disabled in production. Configure HELMET_ENABLE_CSP and HELMET_FRAME_ANCESTORS before campaign cutover.',
      'Security'
    )
  }

  const hasObjectStorage =
    helper.isValid(S3_ENDPOINT) &&
    helper.isValid(S3_REGION) &&
    helper.isValid(S3_BUCKET) &&
    helper.isValid(S3_ACCESS_KEY_ID) &&
    helper.isValid(S3_SECRET_ACCESS_KEY)

  if (!hasObjectStorage) {
    Logger.warn(
      'S3-compatible upload storage is not fully configured in production. Verify upload durability before campaign traffic.',
      'Security'
    )
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false
  })

  // Apollo Server 4 expects req.body to be populated before the GraphQL middleware runs.
  app.use('/graphql', bodyParser.json({ limit: '1mb' }))

  // Verify all params
  app.useGlobalPipes(
    new ValidationPipe({
      forbidUnknownValues: false
    })
  )

  // Catch all exceptions
  app.useGlobalFilters(new AllExceptionsFilter())

  app.enableCors((request, callback) => {
    const origin = request.header('origin')

    callback(null, {
      credentials: CORS_ALLOW_CREDENTIALS,
      origin: !origin ? true : isAllowedOrigin(origin, request)
    })
  })

  // Enable cookie
  app.use(cookieParser())

  // see https://expressjs.com/en/guide/behind-proxies.html
  app.set('trust proxy', 1)

  // Static assets
  app.use(
    '/static',
    serveStatic(STATIC_DIR, {
      maxAge: '30d',
      extensions: ['jpg', 'jpeg', 'bmp', 'webp', 'gif', 'png', 'svg', 'js', 'css'],
      setHeaders: (res, path) => {
        const { attname } = res.req.query

        if (helper.isValid(attname)) {
          res.setHeader('Content-Disposition', `attachment; filename="${attname}"`)
        }
      }
    })
  )

  app.use(
    '/static/upload',
    serveStatic(UPLOAD_DIR, {
      maxAge: '30d',
      extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']
    })
  )

  // Template rendering
  app.engine('html', hbs.__express)
  app.setBaseViewsDir(VIEW_DIR)
  app.setViewEngine('html')

  /**
   * Limit the number of user's requests
   * 1000 requests per minute
   */
  app.use(
    rateLimit({
      headers: false,
      windowMs: ms(GLOBAL_RATE_LIMIT_WINDOW),
      max: GLOBAL_RATE_LIMIT_MAX
    })
  )

  // Security
  app.use(helmet(buildHelmetOptions()))

  logProductionWarnings()

  await app.listen(APP_LISTEN_PORT, APP_LISTEN_HOSTNAME, () => {
    Logger.info(
      `Server is running on http://${APP_LISTEN_HOSTNAME}:${APP_LISTEN_PORT}`,
      'NestApplication'
    )
  })
}

bootstrap()
