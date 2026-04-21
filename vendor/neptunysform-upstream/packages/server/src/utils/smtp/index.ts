import { google } from 'googleapis'
import * as nodemailer from 'nodemailer'

export type MailProvider = 'smtp' | 'gmail'

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

export interface GmailOptions {
  serviceAccountEmail: string
  privateKey: string
  impersonatedUser: string
}

export interface MailOptions {
  provider: MailProvider | string
  smtp: SmtpOptions
  gmail: GmailOptions
}

export interface SmtpMessage {
  from: string
  sender?: string
  to: string
  subject: string
  html: string
}

const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send'

function hasConfigValue(value?: string): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function encodeHeader(value: string): string {
  return /^[\x20-\x7E]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
}

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function buildGmailRawMessage(message: SmtpMessage): string {
  const headers = [
    `From: ${message.from}`,
    `To: ${message.to}`,
    `Subject: ${encodeHeader(message.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64'
  ]

  if (hasConfigValue(message.sender)) {
    headers.splice(1, 0, `Sender: ${message.sender}`)
  }

  return toBase64Url(
    [...headers, '', Buffer.from(message.html, 'utf8').toString('base64')].join('\r\n')
  )
}

function createGmailClient(options: GmailOptions) {
  const auth = new google.auth.JWT(
    options.serviceAccountEmail,
    undefined,
    options.privateKey.replace(/\\n/g, '\n'),
    [GMAIL_SEND_SCOPE],
    options.impersonatedUser
  )

  return {
    auth,
    gmail: google.gmail({
      version: 'v1',
      auth
    })
  }
}

function withSmtpSender(options: MailOptions, message: SmtpMessage): SmtpMessage {
  if (hasConfigValue(message.sender) || !hasConfigValue(options.smtp.user)) {
    return message
  }

  return {
    ...message,
    sender: options.smtp.user
  }
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

export function validateGmailConfig(options: GmailOptions, from?: string): string | null {
  if (!hasConfigValue(from)) {
    return 'Email delivery is not configured on this server. Ask the administrator to set SMTP_FROM.'
  }

  if (!hasConfigValue(options.serviceAccountEmail) || !hasConfigValue(options.privateKey) || !hasConfigValue(options.impersonatedUser)) {
    return 'Email delivery Gmail API credentials are incomplete. Set GMAIL_SERVICE_ACCOUNT_EMAIL, GMAIL_SERVICE_ACCOUNT_PRIVATE_KEY, and GMAIL_IMPERSONATED_USER.'
  }

  return null
}

export function validateMailConfig(options: MailOptions, from?: string): string | null {
  switch (options.provider) {
    case 'gmail':
      return validateGmailConfig(options.gmail, from)
    case 'smtp':
      return validateSmtpConfig(options.smtp, from)
    default:
      return `Unknown mail provider \"${options.provider}\". Set MAIL_PROVIDER to smtp or gmail.`
  }
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

export async function gmailSendMail(
  options: GmailOptions,
  message: SmtpMessage
): Promise<string | unknown> {
  const { auth, gmail } = createGmailClient(options)

  await auth.authorize()

  const result = await gmail.users.messages.send({
    userId: options.impersonatedUser,
    requestBody: {
      raw: buildGmailRawMessage(message)
    }
  })

  return result.data.id || result.data.threadId || 'gmail-api'
}

export async function sendMail(
  options: MailOptions,
  message: SmtpMessage
): Promise<string | unknown> {
  switch (options.provider) {
    case 'gmail':
      try {
        return await gmailSendMail(options.gmail, message)
      } catch (error) {
        if (!validateSmtpConfig(options.smtp, message.from)) {
          return smtpSendMail(options.smtp, withSmtpSender(options, message))
        }

        throw error
      }
    case 'smtp':
      return smtpSendMail(options.smtp, message)
    default:
      throw new Error(`Unknown mail provider \"${options.provider}\". Set MAIL_PROVIDER to smtp or gmail.`)
  }
}
