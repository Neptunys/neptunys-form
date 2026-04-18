# Production Secrets Inventory

Do not store raw production secret values in this file.

Use this document as a control sheet that tells you:

- what secrets exist
- where the source of truth is
- whether they are escrowed outside Render
- who can access them
- when they were last verified

The rule for cutover is simple:

- every production secret must exist in at least one secure system outside Render
- the storage location must be known before any plan or provider migration

## Status Legend

- `Done`: stored outside Render and verified
- `Partial`: known to exist, but not yet verified during this cutover cycle
- `Missing`: no trusted external record yet

## Control Fields

- Primary vault or password manager:
- Secondary backup location:
- Last full verification date:
- Verified by:

## Core App Secrets

| Secret | Purpose | Current Render-backed | External source of truth | Status | Owner | Last verified | Rotation notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `SESSION_KEY` | Session cookie encryption | Yes |  | Missing |  |  | Rotating forces re-login |
| `FORM_ENCRYPTION_KEY` | Form token encryption | Yes |  | Missing |  |  | Rotation affects short-lived protected links and tokens |
| `MONGO_URI` | Primary database connection | Yes |  | Missing |  |  | Must point at the correct production cluster |
| `REDIS_URL` | Redis and queue connection | Yes |  | Missing |  |  | Confirm TLS form if provider requires it |

## Upload Storage Secrets

| Secret | Purpose | Current Render-backed | External source of truth | Status | Owner | Last verified | Rotation notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `S3_ENDPOINT` | Object storage API endpoint | Yes |  | Missing |  |  | Keep provider endpoint documented |
| `S3_REGION` | Object storage region | Yes |  | Missing |  |  | For R2 this may be `auto` |
| `S3_BUCKET` | Upload bucket name | Yes |  | Missing |  |  | Confirm bucket versioning separately |
| `S3_ACCESS_KEY_ID` | Upload access key | Yes |  | Missing |  |  | Use app-specific key, not admin root |
| `S3_SECRET_ACCESS_KEY` | Upload secret | Yes |  | Missing |  |  | Rotate if ever exposed |
| `S3_PUBLIC_URL` | Public base URL for uploaded files | Yes |  | Missing |  |  | Must match live asset serving path |

## Email and Auth Secrets

| Secret | Purpose | Current Render-backed | External source of truth | Status | Owner | Last verified | Rotation notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `SMTP_FROM` | Sender identity | Yes |  | Partial |  |  | Usually not sensitive but should be documented |
| `SMTP_HOST` | Mail server host | Yes |  | Missing |  |  |  |
| `SMTP_PORT` | Mail server port | Yes |  | Missing |  |  |  |
| `SMTP_USER` | Mail auth username | Yes |  | Missing |  |  |  |
| `SMTP_PASSWORD` | Mail auth secret | Yes |  | Missing |  |  | Rotate if mailbox access changes |
| `SMTP_SERVERNAME` | Optional TLS servername override | Yes |  | Partial |  |  |  |
| `SMTP_SECURE` | SMTP TLS mode | Yes |  | Partial |  |  |  |
| `SMTP_IGNORE_CERT` | SMTP certificate bypass setting | Yes |  | Partial |  |  | Should normally be false |
| `ADMIN_APPROVAL_EMAIL` | Admin approval mailbox | Yes |  | Partial |  |  | Confirm mailbox ownership and MFA |

## Domain and Runtime Config

| Setting | Purpose | Current system of truth | Secondary record | Status | Owner | Last verified | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `APP_HOMEPAGE_URL` or Render external URL | Main app URL | Render or platform runtime |  | Partial |  |  | Confirm custom domain mapping |
| `COOKIE_DOMAIN` | Cookie scope | Render env or runtime default |  | Missing |  |  | Must match final production host strategy |
| Live custom domain DNS records | User-facing routing | DNS provider |  | Missing |  |  | Required for rollback and disaster recovery |

## Optional Integrations

| Secret | Purpose | Current Render-backed | External source of truth | Status | Owner | Last verified | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GOOGLE_RECAPTCHA_KEY` | Public bot protection config | Yes |  | Partial |  |  | Public value but should still be documented |
| `GOOGLE_RECAPTCHA_SECRET` | Server-side captcha verification | Yes |  | Missing |  |  | Required if campaigns use captcha |
| `AKISMET_KEY` | Spam filtering | Yes |  | Missing |  |  | Optional but useful for campaign forms |
| `OPENAI_API_KEY` | AI form generation | Yes |  | Missing |  |  | Not required for form delivery |
| `OPENAI_GPT_MODEL` | AI model override | Yes |  | Partial |  |  | Not secret, but should be documented |

## Access Control Checklist

- Render account has MFA enabled
- Mongo provider account has MFA enabled
- DNS provider account has MFA enabled
- mail provider account has MFA enabled
- object storage provider has MFA enabled
- at least two trusted operators can access the recovery secrets
- app credentials are least-privilege and not admin/root credentials

## Required Before Cutover

Mark each item only when complete:

- every `Missing` row is resolved or explicitly retired
- `MONGO_URI` is documented outside Render
- `S3_*` upload credentials are documented outside Render
- email credentials are documented outside Render
- DNS and domain ownership records are documented
- at least one second operator can access the recovery material
