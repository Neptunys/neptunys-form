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

export const MailOptionsFactory = (): MailOptions => ({
  provider: MAIL_PROVIDER,
  smtp: SmtpOptionsFactory(),
  gmail: GmailOptionsFactory()
})
