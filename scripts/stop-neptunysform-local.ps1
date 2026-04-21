$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$neptunysformRoot = Join-Path $repoRoot 'vendor\neptunysform-upstream'

if (-not (Test-Path $neptunysformRoot)) {
  throw "NeptunysForm upstream clone not found at $neptunysformRoot"
}

Push-Location $neptunysformRoot
try {
  docker compose -f docker-compose.test.yml -f docker-compose.local.yml down
}
finally {
  Pop-Location
}
