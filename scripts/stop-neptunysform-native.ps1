$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$statePath = Join-Path $repoRoot '.neptunysform-local\processes.json'

if (-not (Test-Path $statePath)) {
  Write-Host 'No native NeptunysForm process state file found.'
  exit 0
}

$state = Get-Content -Raw -Path $statePath | ConvertFrom-Json

foreach ($name in @('webapp', 'server', 'mailpit')) {
  $entry = $state.$name

  if ($null -eq $entry) {
    continue
  }

  try {
    taskkill /PID $entry.pid /T /F | Out-Null
    Write-Host "Stopped $name (PID $($entry.pid))"
  }
  catch {
    Write-Host "Could not stop $name (PID $($entry.pid)); it may already be stopped."
  }
}

Remove-Item $statePath -Force
