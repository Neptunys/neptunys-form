import {
  GMAIL_IMPERSONATED_USER,
  GMAIL_SERVICE_ACCOUNT_EMAIL,
  GMAIL_SERVICE_ACCOUNT_PRIVATE_KEY,
  MAIL_PROVIDER,
  SMTP_HOST,
  SMTP_IGNORE_CERT,
  SMTP_PASSWORD,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_SERVERNAME,
  SMTP_USER
} from '@environments'
import { GmailOptions, MailOptions, SmtpOptions } from '@utils'

function hasConfigValue(value?: string) {
  return typeof value === 'string' && value.trim().length > 0
}

function resolveMailProvider(gmail: GmailOptions) {
  if (
    MAIL_PROVIDER === 'smtp' &&
    hasConfigValue(gmail.serviceAccountEmail) &&
    hasConfigValue(gmail.privateKey) &&
    hasConfigValue(gmail.impersonatedUser)
  ) {
    return 'gmail'
  }

  return MAIL_PROVIDER
}

export const SmtpOptionsFactory = (): SmtpOptions => ({
  host: SMTP_HOST,
  port: SMTP_PORT,
  user: SMTP_USER,
  password: SMTP_PASSWORD,
  secure: SMTP_SECURE,
  servername: SMTP_SERVERNAME,
  ignoreCert: SMTP_IGNORE_CERT,
  pool: true,
  logger: false
})

export const GmailOptionsFactory = (): GmailOptions => ({
  serviceAccountEmail: GMAIL_SERVICE_ACCOUNT_EMAIL,
  privateKey: GMAIL_SERVICE_ACCOUNT_PRIVATE_KEY,
  impersonatedUser: GMAIL_IMPERSONATED_USER
})

export const MailOptionsFactory = (): MailOptions => {
  const smtp = SmtpOptionsFactory()
  const gmail = GmailOptionsFactory()

  return {
    provider: resolveMailProvider(gmail),
    smtp,
    gmail
  }
}
