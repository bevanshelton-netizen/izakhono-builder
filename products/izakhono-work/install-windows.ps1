#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$Model = "",
  [string]$OllamaImage = "ollama/ollama:latest"
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message, [int]$Code = 1) {
  Write-Error $Message
  exit $Code
}

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Fail "Run this installer from an Administrator PowerShell window." 10
}

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
  Fail "Docker is required on this owner host. Install/start Docker Desktop, then run this installer again." 20
}

try {
  docker info *> $null
  if ($LASTEXITCODE -ne 0) { throw "docker info failed" }
} catch {
  Fail "Docker is installed but its engine is not running. Start Docker Desktop, then run this installer again." 21
}

$ProductDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Dockerfile = Join-Path $ProductDir "Dockerfile"
if (-not (Test-Path $Dockerfile)) { Fail "IZAKHONO WORK Dockerfile is missing." 22 }

if (-not $Model) {
  try {
    $ramBytes = (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory
    if ($ramBytes -ge 24GB) { $Model = "qwen3:8b" } else { $Model = "qwen3:4b" }
  } catch {
    $Model = "qwen3:4b"
  }
}

$Network = "izakhono-work-net"
$DataVolume = "izakhono_work_data"
$OllamaVolume = "izakhono_ollama"

if (-not (docker network ls --format "{{.Name}}" | Where-Object { $_ -eq $Network })) {
  docker network create $Network *> $null
  if ($LASTEXITCODE -ne 0) { Fail "Could not create the IZAKHONO WORK Docker network." 30 }
}

if (-not (docker volume ls --format "{{.Name}}" | Where-Object { $_ -eq $DataVolume })) {
  docker volume create $DataVolume *> $null
}
if (-not (docker volume ls --format "{{.Name}}" | Where-Object { $_ -eq $OllamaVolume })) {
  docker volume create $OllamaVolume *> $null
}

$ollamaExists = docker ps -a --format "{{.Names}}" | Where-Object { $_ -eq "izakhono-ollama" }
if (-not $ollamaExists) {
  docker run -d --name izakhono-ollama --restart unless-stopped `
    --network $Network `
    -p 127.0.0.1:11434:11434 `
    -v "${OllamaVolume}:/root/.ollama" `
    $OllamaImage *> $null
  if ($LASTEXITCODE -ne 0) { Fail "Could not start the local model runtime." 31 }
} else {
  docker start izakhono-ollama *> $null
  $networks = docker inspect -f "{{range `$k,`$v := .NetworkSettings.Networks}}{{printf `"%s`n`" `$k}}{{end}}" izakhono-ollama
  if ($networks -notcontains $Network) {
    docker network connect $Network izakhono-ollama *> $null
  }
}

$ollamaReady = $false
for ($i = 0; $i -lt 90; $i++) {
  try {
    Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 3 | Out-Null
    $ollamaReady = $true
    break
  } catch {
    Start-Sleep -Seconds 2
  }
}
if (-not $ollamaReady) {
  docker logs --tail 100 izakhono-ollama
  Fail "The local model runtime did not become healthy." 32
}

Write-Host "Preparing owner model: $Model"
docker exec izakhono-ollama ollama pull $Model
if ($LASTEXITCODE -ne 0) { Fail "The owner model could not be downloaded." 33 }

docker build -t izakhono/work:local $ProductDir
if ($LASTEXITCODE -ne 0) { Fail "IZAKHONO WORK application image build failed." 34 }

docker rm -f izakhono-work *> $null 2>&1
docker run -d --name izakhono-work --restart unless-stopped `
  --network $Network `
  -p 127.0.0.1:9393:9393 `
  -e "IZAKHONO_WORK_MODEL=$Model" `
  -e "IZAKHONO_WORK_TOKEN=" `
  -v "${DataVolume}:/data" `
  izakhono/work:local *> $null
if ($LASTEXITCODE -ne 0) { Fail "IZAKHONO WORK container failed to start." 35 }

$workReady = $false
for ($i = 0; $i -lt 60; $i++) {
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:9393/healthz" -TimeoutSec 3
    if ($health.ok) {
      $workReady = $true
      break
    }
  } catch {
    Start-Sleep -Seconds 2
  }
}
if (-not $workReady) {
  docker logs --tail 100 izakhono-work
  Fail "IZAKHONO WORK did not pass its local health gate." 36
}

$publicDesktop = [Environment]::GetFolderPath("CommonDesktopDirectory")
$shortcut = Join-Path $publicDesktop "IZAKHONO WORK.url"
@"
[InternetShortcut]
URL=http://127.0.0.1:9393
"@ | Set-Content -Path $shortcut -Encoding ASCII

Write-Host ""
Write-Host "IZAKHONO_WORK=READY"
Write-Host "Local workspace: http://127.0.0.1:9393"
Write-Host "Owner model: $Model"
Write-Host "Desktop shortcut: $shortcut"
Write-Host "No subscription or per-message usage-credit gate is implemented."
Write-Host "This release remains localhost-only; do not expose port 9393 directly to the internet."
