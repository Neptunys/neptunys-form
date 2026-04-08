$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$heyformRoot = Join-Path $repoRoot 'vendor\heyform-upstream'

if (-not (Test-Path $heyformRoot)) {
  throw "HeyForm upstream clone not found at $heyformRoot"
}

Push-Location $heyformRoot
try {
  docker compose -f docker-compose.test.yml -f docker-compose.local.yml down
}
finally {
  Pop-Location
}
