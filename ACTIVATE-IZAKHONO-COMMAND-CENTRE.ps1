#requires -Version 5.1
[CmdletBinding()]
param([string]$Distro = 'Ubuntu-24.04')

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Step([string]$Text) {
    Write-Host ""
    Write-Host $Text -ForegroundColor Cyan
}

$repo = (Resolve-Path $PSScriptRoot).Path
$distros = @(wsl.exe -l -q 2>$null | ForEach-Object { ($_ -replace "`0", '').Trim() } | Where-Object { $_ })
if ($distros -notcontains $Distro) {
    if ($Distro -eq 'Ubuntu-24.04' -and $distros -contains 'Ubuntu') {
        $Distro = 'Ubuntu'
    } else {
        throw "[STOP] IZAKHONO owner host Ubuntu is not installed. Activate the owner host first."
    }
}

$linuxRepo = (& wsl.exe -d $Distro -- wslpath -a "$repo").Trim()
if (-not $linuxRepo) { throw "[STOP] Could not map the repository into the IZAKHONO owner-host environment." }

Step "[1/5] Activating IZAKHONO NODE + CONTROL"
& wsl.exe -d $Distro -u root -- bash "$linuxRepo/products/izakhono-node/install.sh"
if ($LASTEXITCODE -ne 0) { throw "[STOP] NODE + CONTROL activation failed." }

Step "[2/5] Synchronising IZAKHONO Builder into owned CODE"
& wsl.exe -d $Distro -u root -- bash "$linuxRepo/products/izakhono-node/sync-builder-to-code.sh" "$linuxRepo"
if ($LASTEXITCODE -ne 0) { throw "[STOP] Builder -> IZAKHONO CODE sync failed." }

Step "[3/5] Installing the owned Command Centre gateway"
& wsl.exe -d $Distro -u root -- bash "$linuxRepo/internal/node01-command-gateway/install-owned-gateway.sh"
if ($LASTEXITCODE -ne 0) { throw "[STOP] Owned Command Centre gateway installation failed." }

Step "[4/5] Verifying CONTROL, NODE and Command Centre"
$health = (& wsl.exe -d $Distro -u root -- bash -lc "curl -fsS http://127.0.0.1:8091/healthz") -join "`n"
if (-not $health.Trim()) { throw "[STOP] Command Centre health proof was empty." }
Write-Host $health -ForegroundColor Green

$nodeHealth = (& wsl.exe -d $Distro -u root -- bash -lc "curl -fsS http://127.0.0.1:9191/readyz") -join "`n"
$controlHealth = (& wsl.exe -d $Distro -u root -- bash -lc "curl -fsS http://127.0.0.1:9292/healthz") -join "`n"

Step "[5/5] Writing activation receipt"
$desktop = [Environment]::GetFolderPath("Desktop")
$report = Join-Path $desktop "IZAKHONO-COMMAND-CENTRE-ACTIVATION.txt"
@(
    "IZAKHONO COMMAND CENTRE ACTIVATION"
    "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss K')"
    "Authority: IZAKHONO CONTROL -> NODE"
    "Command Centre: http://127.0.0.1:8091/commands"
    "NODE: http://127.0.0.1:9191"
    "CONTROL: http://127.0.0.1:9292"
    "NODE_READY=$nodeHealth"
    "CONTROL_HEALTH=$controlHealth"
    "COMMAND_HEALTH=$health"
    "PUBLIC_LIVE_NOT_CLAIMED=true"
) | Set-Content -Path $report -Encoding UTF8

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkCyan
Write-Host "[PASS] IZAKHONO COMMAND CENTRE INTERNAL CONTROL PATH READY" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor DarkCyan
Write-Host "Open: http://127.0.0.1:8091/commands"
Write-Host "Receipt: $report"
Write-Host ""
Write-Host "Owner command credential remains protected in /etc/izakhono/commands.owner-token."
Write-Host "Public EDGE/TLS is a separate verification gate."

$ownerCredential = (& wsl.exe -d $Distro -u root -- bash -lc "cat /etc/izakhono/commands.owner-token") -join ""
if (-not $ownerCredential.Trim()) { throw "[STOP] Owner command credential was not created." }
$ownerUrl = "http://127.0.0.1:8091/commands#owner=$($ownerCredential.Trim())"
Start-Process $ownerUrl
