$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "IZAKHONO NODE01 Sovereign Host Bootstrap" -ForegroundColor Cyan

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker is not installed or not on PATH."
}

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  throw ".env created. Replace every CHANGE_ME value, then run this script again."
}

$envText = Get-Content ".env" -Raw
if ($envText -match "CHANGE_ME") {
  throw "Replace every CHANGE_ME value in .env before activation."
}

New-Item -ItemType Directory -Force -Path "sites" | Out-Null

docker compose pull
docker compose up -d
docker compose ps

Write-Host ""
Write-Host "Base host started. Run VERIFY-NODE01.ps1 next." -ForegroundColor Green
