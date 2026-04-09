$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$statePath = Join-Path $repoRoot '.heyform-local\processes.json'

if (-not (Test-Path $statePath)) {
  Write-Host 'No native HeyForm process state file found.'
  exit 0
}

$state = Get-Content -Raw -Path $statePath | ConvertFrom-Json

foreach ($name in @('webapp', 'server', 'mailpit')) {
  $entry = $state.$name

  if ($null -eq $entry) {
    continue
  }

  try {
    Stop-Process -Id $entry.pid -Force -ErrorAction Stop
    Write-Host "Stopped $name (PID $($entry.pid))"
  }
  catch {
    Write-Host "Could not stop $name (PID $($entry.pid)); it may already be stopped."
  }
}

Remove-Item $statePath -Force
