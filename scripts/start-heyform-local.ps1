param(
  [int]$WaitSeconds = 90
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$heyformRoot = Join-Path $repoRoot 'vendor\heyform-upstream'
$envFile = Join-Path $heyformRoot '.env'
$composeOverrideFile = Join-Path $heyformRoot 'docker-compose.local.yml'

$envContent = @"
APP_HOMEPAGE_URL=http://localhost:9513
ENABLE_GOOGLE_FONTS=false

SESSION_MAX_AGE=15d
SESSION_KEY=local-dev-session-key-please-rotate
FORM_ENCRYPTION_KEY=local-dev-form-key-please-rotate

SMTP_FROM=HeyForm Local <noreply@local.test>
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_SECURE=false
SMTP_SERVERNAME=
SMTP_IGNORE_CERT=false

VERIFY_EMAIL_RESEND_COOLDOWN=60s
VERIFY_EMAIL_RESEND_DAILY_LIMIT=20

BULL_JOB_ATTEMPTS=3
BULL_JOB_BACKOFF_DELAY=3000
BULL_JOB_BACKOFF_TYPE=fixed

REDIS_DB=0
"@

$composeOverrideContent = @'
services:
  heyform:
    environment:
      SMTP_FROM: ${SMTP_FROM:-HeyForm Local <noreply@local.test>}
      SMTP_HOST: mailpit
      SMTP_PORT: 1025
      SMTP_SECURE: false
      SMTP_SERVERNAME: ""
      SMTP_IGNORE_CERT: false
    depends_on:
      - mailpit

  mailpit:
    image: axllent/mailpit:latest
    restart: unless-stopped
    ports:
      - '8025:8025'
      - '1025:1025'
'@

if (-not (Test-Path $heyformRoot)) {
  throw "HeyForm upstream clone not found at $heyformRoot"
}

Set-Content -Path $envFile -Value $envContent -Encoding UTF8
Set-Content -Path $composeOverrideFile -Value $composeOverrideContent -Encoding UTF8

$dockerDesktopCandidates = @(
  (Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'),
  (Join-Path $env:LocalAppData 'Docker\Docker Desktop.exe')
) | Where-Object { Test-Path $_ }

if ($dockerDesktopCandidates.Count -gt 0 -and -not (Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue)) {
  Start-Process $dockerDesktopCandidates[0] | Out-Null
}

$deadline = (Get-Date).AddSeconds($WaitSeconds)
$dockerReady = $false

while ((Get-Date) -lt $deadline) {
  docker info | Out-Null
  if ($LASTEXITCODE -eq 0) {
    $dockerReady = $true
    break
  }

  Start-Sleep -Seconds 3
}

if (-not $dockerReady) {
  throw 'Docker engine is not ready. Start Docker Desktop and retry this script.'
}

Push-Location $heyformRoot
try {
  docker compose -f docker-compose.test.yml -f docker-compose.local.yml up -d --build
}
finally {
  Pop-Location
}

Write-Host ''
Write-Host 'HeyForm local stack started:'
Write-Host '  App:     http://localhost:9513'
Write-Host '  Mailpit: http://localhost:8025'
