import * as assert from 'assert'
import { readFileSync, readdirSync } from 'fs'
import { basename, extname, join } from 'path'

import { SendResetPasswordEmailResolver } from '../src/resolver/auth/send-reset-password-email.resolver'

const projectRoot = join(__dirname, '..')
const mailServicePath = join(projectRoot, 'src', 'service', 'mail.service.ts')
const emailTemplatesDir = join(projectRoot, 'resources', 'email-templates')

function readReferencedTemplateNames() {
  const content = readFileSync(mailServicePath, 'utf8')

  return Array.from(content.matchAll(/this\.addQueue\('([^']+)'/g)).map(match => match[1]).sort()
}

function readAvailableTemplateNames() {
  return readdirSync(emailTemplatesDir)
    .filter(fileName => extname(fileName) === '.html')
    .map(fileName => basename(fileName, '.html'))
    .sort()
}

async function testAllReferencedMailTemplatesExist() {
  const referencedTemplateNames = readReferencedTemplateNames()
  const availableTemplateNames = new Set(readAvailableTemplateNames())
  const missingTemplateNames = referencedTemplateNames.filter(name => !availableTemplateNames.has(name))

  assert.deepStrictEqual(
    missingTemplateNames,
    [],
    `Missing email templates: ${missingTemplateNames.join(', ')}`
  )
}

async function testResetPasswordResolverUsesDedicatedMailTemplate() {
  let resetPasswordRecipient: string | undefined
  let resetPasswordCode: string | undefined
  let emailVerificationCalled = false

  const resolver = new SendResetPasswordEmailResolver(
    {
      resetPasswordRequest: async (to: string, code: string) => {
        resetPasswordRecipient = to
        resetPasswordCode = code
      },
      emailVerificationRequest: async () => {
        emailVerificationCalled = true
      }
    } as any,
    {
      findByEmail: async () => ({
        id: 'user_1'
      })
    } as any,
    {
      getVerificationCodeWithRateLimit: async () => '482901'
    } as any
  )

  await resolver.sendResetPasswordEmail({
    email: 'person@example.com'
  } as any)

  assert.strictEqual(resetPasswordRecipient, 'person@example.com')
  assert.strictEqual(resetPasswordCode, '482901')
  assert.strictEqual(emailVerificationCalled, false)
}

async function run() {
  await testAllReferencedMailTemplatesExist()
  await testResetPasswordResolverUsesDedicatedMailTemplate()
}

if (require.main === module) {
  run().catch(error => {
    // eslint-disable-next-line no-console
    console.error(error)
    process.exitCode = 1
  })
}