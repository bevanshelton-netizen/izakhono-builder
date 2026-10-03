$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "IZAKHONO NODE01 Verification" -ForegroundColor Cyan
docker compose ps

$failed = docker compose ps --format json | Select-String -Pattern '"State":"exited"|"State":"dead"'
if ($failed) {
  throw "One or more sovereign host containers are not running."
}

try {
  $tcp80 = Test-NetConnection -ComputerName 127.0.0.1 -Port 80 -WarningAction SilentlyContinue
  if (-not $tcp80.TcpTestSucceeded) { throw "Port 80 is not listening." }
} catch { throw }

Write-Host "LOCAL HOST GATE: PASS" -ForegroundColor Green
Write-Host "Public DNS/HTTPS must still be verified before any domain is called LIVE." -ForegroundColor Yellow
