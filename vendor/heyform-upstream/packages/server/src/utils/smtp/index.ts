import * as nodemailer from 'nodemailer'

export interface SmtpOptions {
  host: string
  port: number
  user: string
  password: string
  secure: boolean
  servername: string
  ignoreCert: boolean
  pool: boolean
  logger: any
}

export interface SmtpMessage {
  from: string
  sender?: string
  to: string
  subject: string
  html: string
}

function hasConfigValue(value?: string): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

export function validateSmtpConfig(options: SmtpOptions, from?: string): string | null {
  if (!hasConfigValue(from) || !hasConfigValue(options.host) || !Number.isFinite(options.port) || options.port <= 0) {
    return 'Email delivery is not configured on this server. Ask the administrator to set SMTP_FROM, SMTP_HOST, and SMTP_PORT.'
  }

  const hasUser = hasConfigValue(options.user)
  const hasPassword = hasConfigValue(options.password)

  if (hasUser !== hasPassword) {
    return 'Email delivery SMTP credentials are incomplete. Set both SMTP_USER and SMTP_PASSWORD.'
  }

  return null
}

export async function smtpSendMail(
  options: SmtpOptions,
  message: SmtpMessage
): Promise<string | unknown> {
  const transport = nodemailer.createTransport({
    host: options.host,
    port: options.port,
    secure: options.secure,
    auth: {
      user: options.user,
      pass: options.password
    },
    tls: {
      servername: options.servername,
      rejectUnauthorized: !options.ignoreCert
    },
    pool: options.pool,
    logger: options.logger
  } as any)

  const result = await transport.sendMail(message)
  return result.messageId
}
