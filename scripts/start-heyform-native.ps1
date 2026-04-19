$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$heyformRoot = Join-Path $repoRoot 'vendor\heyform-upstream'
$serverEnvPath = Join-Path $heyformRoot 'packages\server\.env'
$webappEnvPath = Join-Path $heyformRoot 'packages\webapp\.env'
$stateRoot = Join-Path $repoRoot '.heyform-local'
$logRoot = Join-Path $stateRoot 'logs'
$serverOverrideEnvPath = Join-Path $stateRoot 'server.override.env'
$webappOverrideEnvPath = Join-Path $stateRoot 'webapp.override.env'

if (-not (Test-Path $heyformRoot)) {
  throw "NeptunysForm upstream clone not found at $heyformRoot"
}

New-Item -ItemType Directory -Force -Path $stateRoot | Out-Null
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null

$preferredWebappPort = 3000
$fallbackWebappPort = 3001
$webappPort = $preferredWebappPort

$preferredWebappListener = Get-NetTCPConnection -LocalPort $preferredWebappPort -State Listen -ErrorAction SilentlyContinue |
  Select-Object -First 1

if ($null -ne $preferredWebappListener) {
  $listenerProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($preferredWebappListener.OwningProcess)" -ErrorAction SilentlyContinue
  $listenerCommand = $listenerProcess.CommandLine

  if ($listenerCommand -notlike "*$heyformRoot*") {
    $fallbackWebappListener = Get-NetTCPConnection -LocalPort $fallbackWebappPort -State Listen -ErrorAction SilentlyContinue |
      Select-Object -First 1

    if ($null -ne $fallbackWebappListener) {
      throw "Ports $preferredWebappPort and $fallbackWebappPort are both in use. Free one of them before starting the native Heyform stack."
    }

    $webappPort = $fallbackWebappPort
  }
}

$homepageUrl = "http://localhost:$webappPort"

$serverEnv = @"
APP_LISTEN_HOSTNAME=127.0.0.1
APP_LISTEN_PORT=9157
APP_HOMEPAGE_URL=$homepageUrl
COOKIE_DOMAIN=localhost
ENABLE_GOOGLE_FONTS=false
SESSION_MAX_AGE=15d
SESSION_KEY=local-dev-session-key-change-me
FORM_ENCRYPTION_KEY=local-dev-form-key-change-me
MONGO_URI=mongodb://127.0.0.1:27017/heyform
MONGO_USER=
MONGO_PASSWORD=
UPLOAD_FILE_TYPES=.jpg,.jpeg,.png,.bmp,.gif,.webp,.svg,.txt,.md,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.pdf,.mp4,.wmv,.zip,.rar,.7z
MAIL_PROVIDER=smtp
SMTP_FROM=NeptunysForm <noreply@localhost>
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_SECURE=false
SMTP_IGNORE_CERT=true
VERIFY_USER_EMAIL=true
VERIFY_EMAIL_RESEND_COOLDOWN=60s
VERIFY_EMAIL_RESEND_DAILY_LIMIT=20
GOOGLE_LOGIN_CLIENT_ID=
GOOGLE_LOGIN_CLIENT_SECRET=
APPLE_LOGIN_TEAM_ID=
APPLE_LOGIN_WEB_CLIENT_ID=
APPLE_LOGIN_KEY_ID=
APPLE_LOGIN_PRIVATE_KEY_PATH=
AKISMET_KEY=
GOOGLE_RECAPTCHA_KEY=
GOOGLE_RECAPTCHA_SECRET=
BULL_JOB_ATTEMPTS=3
BULL_JOB_BACKOFF_DELAY=3000
BULL_JOB_BACKOFF_TYPE=fixed
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DB=0
UNSPLASH_CLIENT_ID=
STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_CONNECT_CLIENT_ID=
STRIPE_WEBHOOK_SECRET_KEY=
OPENAI_BASE_URL=
OPENAI_API_KEY=
"@

$webappEnv = @"
VITE_HOMEPAGE_URL=$homepageUrl
VITE_COOKIE_DOMAIN=localhost
VITE_COOKIE_DOMAIN_REWRITE=127.0.0.1
VITE_PROXY_TARGET=http://127.0.0.1:9157
VITE_GRAPHQL_API_URL=/graphql
VITE_CDN_UPLOAD_URL=/api
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_GOOGLE_RECAPTCHA_KEY=
VITE_DISABLE_LOGIN_WITH_GOOGLE=true
VITE_DISABLE_LOGIN_WITH_APPLE=true
VITE_VERIFY_USER_EMAIL=true
VITE_ENABLE_GOOGLE_FONTS=false
"@

if (Test-Path $serverOverrideEnvPath) {
  $serverOverrideEnv = Get-Content -Path $serverOverrideEnvPath -Raw

  if (-not [string]::IsNullOrWhiteSpace($serverOverrideEnv)) {
    $serverEnv += "`r`n$serverOverrideEnv"
  }
}

if (Test-Path $webappOverrideEnvPath) {
  $webappOverrideEnv = Get-Content -Path $webappOverrideEnvPath -Raw

  if (-not [string]::IsNullOrWhiteSpace($webappOverrideEnv)) {
    $webappEnv += "`r`n$webappOverrideEnv"
  }
}

Set-Content -Path $serverEnvPath -Value $serverEnv -Encoding UTF8
Set-Content -Path $webappEnvPath -Value $webappEnv -Encoding UTF8

$mailpitCandidates = @(@(
  (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages\axllent.mailpit_Microsoft.Winget.Source_8wekyb3d8bbwe\mailpit.exe'),
  (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\mailpit.exe')
) | Where-Object { Test-Path $_ })

if ($mailpitCandidates.Count -eq 0) {
  throw 'Mailpit executable not found. Install it first with winget install axllent.mailpit'
}

if (-not (Get-Service Redis -ErrorAction SilentlyContinue)) {
  throw 'Redis service not found. Install or start Redis before running this script.'
}

if ((Get-Service Redis).Status -ne 'Running') {
  Start-Service Redis
}

function Test-MongoListener {
  return $null -ne (Get-NetTCPConnection -LocalPort 27017 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
}

function Get-MongodPathFromService {
  $mongoService = Get-CimInstance Win32_Service -Filter "Name='MongoDB'" -ErrorAction SilentlyContinue

  if ($null -eq $mongoService -or [string]::IsNullOrWhiteSpace($mongoService.PathName)) {
    return $null
  }

  if ($mongoService.PathName -match '"([^"]*mongod\.exe)"') {
    return $matches[1]
  }

  $servicePath = $mongoService.PathName.Split(' ')[0]
  if ($servicePath -like '*mongod.exe*') {
    return $servicePath
  }

  return $null
}

if (-not (Test-MongoListener)) {
  $mongoService = Get-Service -Name MongoDB -ErrorAction SilentlyContinue

  if ($null -ne $mongoService -and $mongoService.Status -ne 'Running') {
    try {
      Start-Service MongoDB
    }
    catch {
      Write-Host 'MongoDB service start failed; falling back to manual mongod startup.'
    }
  }
}

if (-not (Test-MongoListener)) {
  $mongodPath = Get-MongodPathFromService
  if ([string]::IsNullOrWhiteSpace($mongodPath)) {
    $mongodCmd = Get-Command mongod -ErrorAction SilentlyContinue
    $mongodPath = $mongodCmd.Source
  }

  if ([string]::IsNullOrWhiteSpace($mongodPath) -or -not (Test-Path $mongodPath)) {
    throw 'MongoDB is not running and mongod executable could not be found. Install/start MongoDB first.'
  }

  $fallbackDbPath = 'D:\MongoDB\data\db'
  $fallbackLogPath = 'D:\MongoDB\log\mongod.log'

  New-Item -ItemType Directory -Force -Path $fallbackDbPath | Out-Null
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $fallbackLogPath) | Out-Null

  Start-Process -FilePath $mongodPath -ArgumentList @(
    '--dbpath', $fallbackDbPath,
    '--logpath', $fallbackLogPath,
    '--bind_ip', '127.0.0.1',
    '--port', '27017'
  ) | Out-Null
}

if (-not (Test-MongoListener)) {
  throw 'MongoDB is not listening on 127.0.0.1:27017 after startup attempts.'
}

$processSpecs = @(
  @{
    Name = 'mailpit'
    FilePath = $mailpitCandidates[0]
    Arguments = '--listen 127.0.0.1:8025 --smtp 127.0.0.1:1025'
    WorkingDirectory = $repoRoot
  },
  @{
    Name = 'server'
    FilePath = 'powershell.exe'
    Arguments = '-NoLogo -NoProfile -ExecutionPolicy Bypass -Command "Set-Location ''' + $heyformRoot + '''; corepack pnpm --filter ./packages/server build; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; corepack pnpm --filter ./packages/server start"'
    WorkingDirectory = $heyformRoot
  },
  @{
    Name = 'webapp'
    FilePath = 'powershell.exe'
    Arguments = '-NoLogo -NoProfile -ExecutionPolicy Bypass -Command "Set-Location ''' + $heyformRoot + '''; corepack pnpm --filter ./packages/webapp exec vite --host 127.0.0.1 --port ' + $webappPort + '"'
    WorkingDirectory = $heyformRoot
  }
)

$state = [ordered]@{}

foreach ($spec in $processSpecs) {
  $stdout = Join-Path $logRoot ($spec.Name + '.out.log')
  $stderr = Join-Path $logRoot ($spec.Name + '.err.log')

  $process = Start-Process -FilePath $spec.FilePath `
    -ArgumentList $spec.Arguments `
    -WorkingDirectory $spec.WorkingDirectory `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -PassThru

  $state[$spec.Name] = @{
    pid = $process.Id
    stdout = $stdout
    stderr = $stderr
  }
}

$statePath = Join-Path $stateRoot 'processes.json'
$state | ConvertTo-Json -Depth 4 | Set-Content -Path $statePath -Encoding UTF8

Write-Host ''
Write-Host 'NeptunysForm native local stack started:'
Write-Host "  App:     $homepageUrl"
Write-Host '  API:     http://127.0.0.1:9157/graphql'
Write-Host '  Mailpit: http://127.0.0.1:8025'
Write-Host ''
Write-Host "Logs: $logRoot"
