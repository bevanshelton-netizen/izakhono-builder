[CmdletBinding()]
param(
    [string]$ReportPath = ""
)

$ErrorActionPreference = "Continue"
$checks = [System.Collections.Generic.List[object]]::new()

function Add-Check {
    param([string]$Name, [bool]$Passed, [string]$Detail, [string]$Remediation = "")
    $checks.Add([pscustomobject]@{
        name = $Name
        passed = $Passed
        detail = $Detail
        remediation = $Remediation
    })
}

Write-Host "IZAKHONO HOST — Windows / WSL2 preflight" -ForegroundColor Cyan
Write-Host "Read-only assessment. This script installs, changes, starts and downloads nothing."
Write-Host ""

$os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
if ($os) {
    $memoryGb = [math]::Round(($os.TotalVisibleMemorySize * 1KB) / 1GB, 1)
    Add-Check "Windows detected" $true "$($os.Caption); build $($os.BuildNumber)"
    Add-Check "Memory baseline" ($memoryGb -ge 4) "$memoryGb GB RAM detected" "For the local MVP, 4 GB is a recommended minimum; do not purchase hardware solely for this check."
} else {
    Add-Check "Windows detected" $false "Could not read Windows operating-system information."
}

$systemDrive = $env:SystemDrive
$drive = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$systemDrive'" -ErrorAction SilentlyContinue
if ($drive) {
    $freeGb = [math]::Round($drive.FreeSpace / 1GB, 1)
    Add-Check "System drive space" ($freeGb -ge 20) "$freeGb GB free on $systemDrive" "The local MVP recommends 20 GB free disk space."
}

$wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
Add-Check "WSL command" ([bool]$wsl) $(if ($wsl) { "wsl.exe is available." } else { "WSL is not available on PATH." }) "If WSL is absent, report this result first. This preflight does not install or enable Windows features."

if ($wsl) {
    $wslVersion = (& wsl.exe --version 2>&1 | Out-String).Trim()
    $wslExit = $LASTEXITCODE
    Add-Check "WSL version query" ($wslExit -eq 0) $(if ($wslExit -eq 0) { ($wslVersion -split "`r?`n" | Select-Object -First 2) -join "; " } else { "WSL version query did not succeed; inspect WSL manually." }) "No WSL upgrade or distribution installation is performed."

    $distros = @(& wsl.exe --list --quiet 2>$null | ForEach-Object { ($_ -replace "`0", "").Trim() } | Where-Object { $_ })
    $hasDistro = $distros.Count -gt 0
    Add-Check "Linux distribution" $hasDistro $(if ($hasDistro) { "Registered distribution(s): $($distros -join ', ')" } else { "No registered WSL Linux distribution was detected." }) "A Linux distribution may be needed for the existing Linux-based HOST MVP. Do not install one until we review the machine's current state."
}

$docker = Get-Command docker.exe -ErrorAction SilentlyContinue
if (-not $docker) { $docker = Get-Command docker -ErrorAction SilentlyContinue }
Add-Check "Docker CLI" ([bool]$docker) $(if ($docker) { "Docker CLI is available." } else { "Docker CLI was not found." }) "No Docker installation is attempted. We will evaluate the no-purchase runtime options from the report."

if ($docker) {
    $dockerVersion = (& $docker.Source version --format '{{.Client.Version}}' 2>&1 | Out-String).Trim()
    $versionOk = ($LASTEXITCODE -eq 0 -and $dockerVersion)
    Add-Check "Docker client" ([bool]$versionOk) $(if ($versionOk) { "Docker client version $dockerVersion" } else { "Docker client did not return a version." })
    $dockerInfo = (& $docker.Source info --format '{{.ServerVersion}}' 2>&1 | Out-String).Trim()
    $daemonOk = ($LASTEXITCODE -eq 0 -and $dockerInfo)
    Add-Check "Docker engine reachable" ([bool]$daemonOk) $(if ($daemonOk) { "Docker engine server version $dockerInfo" } else { "Docker engine is not reachable or is not running. No service was started." }) "Do not install or purchase Docker Desktop as a reflex. We will assess existing WSL2 and free runtime choices first."
}

$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) { $node = Get-Command node -ErrorAction SilentlyContinue }
Add-Check "Node.js" ([bool]$node) $(if ($node) { (& $node.Source --version 2>&1 | Out-String).Trim() } else { "Node.js was not found." }) "No Node.js installation is attempted."

$git = Get-Command git.exe -ErrorAction SilentlyContinue
if (-not $git) { $git = Get-Command git -ErrorAction SilentlyContinue }
Add-Check "Git" ([bool]$git) $(if ($git) { (& $git.Source --version 2>&1 | Out-String).Trim() } else { "Git was not found." }) "No Git installation is attempted."

Write-Host ""
$checks | Format-Table -AutoSize -Wrap
$passed = @($checks | Where-Object passed).Count
$total = $checks.Count
Write-Host ""
Write-Host "Read-only preflight: $passed / $total checks passed." -ForegroundColor Cyan
Write-Host "No software was installed, no services were started, no firewall or network settings were changed, and no secrets were read or printed."

if ($ReportPath) {
    $parent = Split-Path -Parent $ReportPath
    if ($parent -and -not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    [pscustomobject]@{
        generated_at_utc = [DateTime]::UtcNow.ToString("o")
        computer = $env:COMPUTERNAME
        checks = @($checks)
        passed = $passed
        total = $total
    } | ConvertTo-Json -Depth 5 | Set-Content -Path $ReportPath -Encoding UTF8
    Write-Host "Report written to: $ReportPath"
}
