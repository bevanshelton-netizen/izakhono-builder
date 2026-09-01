#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$Distro = 'Ubuntu',
    [switch]$Resume,
    [switch]$NoRestart,
    [switch]$AttemptRouterMapping,
    [switch]$StatusOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Write-Stage([string]$Message) {
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Quote-Argument([string]$Value) {
    return '"' + ($Value -replace '"', '\"') + '"'
}

function Quote-Bash([string]$Value) {
    return "'" + ($Value -replace "'", "'\"'\"'") + "'"
}

function Get-InstalledDistros {
    $items = @()
    try {
        $items = @(wsl.exe -l -q 2>$null | ForEach-Object { ($_ -replace "`0", '').Trim() } | Where-Object { $_ })
    } catch {
        $items = @()
    }
    return $items
}

function Test-DistroInstalled([string]$Name) {
    return (Get-InstalledDistros) -contains $Name
}

function Ensure-Admin {
    if (Test-IsAdministrator) { return }
    Write-Host 'Requesting Windows administrator approval for the IZAKHONO owner host...'
    $args = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath, '-Distro', $Distro)
    if ($Resume) { $args += '-Resume' }
    if ($NoRestart) { $args += '-NoRestart' }
    if ($AttemptRouterMapping) { $args += '-AttemptRouterMapping' }
    if ($StatusOnly) { $args += '-StatusOnly' }
    Start-Process -FilePath 'PowerShell.exe' -Verb RunAs -ArgumentList ($args | ForEach-Object { Quote-Argument $_ })
    exit 0
}

function Ensure-WindowsCapability {
    $version = [Environment]::OSVersion.Version
    if (-not [Environment]::Is64BitOperatingSystem) {
        throw '[FAIL] IZAKHONO owner host requires 64-bit Windows.'
    }
    if ($version.Major -lt 10) {
        throw '[FAIL] IZAKHONO owner host requires Windows 10/11 or newer.'
    }
    $memoryGb = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
    if ($memoryGb -lt 4) {
        throw "[FAIL] At least 4 GB RAM is required for the Windows owner-host bridge (detected ${memoryGb} GB)."
    }
    $systemDrive = Get-PSDrive -Name ([IO.Path]::GetPathRoot($env:SystemRoot).Substring(0,1))
    $freeGb = [math]::Round($systemDrive.Free / 1GB, 1)
    if ($freeGb -lt 12) {
        throw "[FAIL] At least 12 GB free on the Windows system drive is required (detected ${freeGb} GB)."
    }
    Write-Host "Windows host capacity: ${memoryGb} GB RAM, ${freeGb} GB free."
}

function Enable-FeatureIfNeeded([string]$FeatureName) {
    $feature = Get-WindowsOptionalFeature -Online -FeatureName $FeatureName
    if ($feature.State -eq 'Enabled') { return $false }
    Write-Host "Enabling Windows feature: $FeatureName"
    $result = Enable-WindowsOptionalFeature -Online -FeatureName $FeatureName -All -NoRestart
    return [bool]$result.RestartNeeded
}

function Register-ResumeTask {
    $taskName = 'IZAKHONO Owner Host Continue'
    $userId = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath, '-Distro', $Distro, '-Resume')
    if ($NoRestart) { $argList += '-NoRestart' }
    if ($AttemptRouterMapping) { $argList += '-AttemptRouterMapping' }
    $argument = ($argList | ForEach-Object { Quote-Argument $_ }) -join ' '
    $action = New-ScheduledTaskAction -Execute 'PowerShell.exe' -Argument $argument
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
    $principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Highest
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
    Write-Host 'Automatic post-restart continuation has been registered.'
}

function Remove-ResumeTask {
    Unregister-ScheduledTask -TaskName 'IZAKHONO Owner Host Continue' -Confirm:$false -ErrorAction SilentlyContinue
}

function Ensure-Distro {
    if (Test-DistroInstalled $Distro) { return $false }
    Write-Host "Installing WSL distribution: $Distro"
    & wsl.exe --install -d $Distro --no-launch
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'The installed WSL version does not accept --no-launch; retrying with the standard installer.'
        & wsl.exe --install -d $Distro
        if ($LASTEXITCODE -ne 0) {
            throw '[FAIL] Windows could not install the requested WSL distribution.'
        }
    }
    return -not (Test-DistroInstalled $Distro)
}

function Enable-WslSystemd {
    Write-Stage 'Enable Linux service management'
    & wsl.exe -d $Distro -u root -- bash -lc "printf '[boot]\\nsystemd=true\\n' > /etc/wsl.conf"
    if ($LASTEXITCODE -ne 0) { throw '[FAIL] Could not configure systemd in WSL.' }
    & wsl.exe --terminate $Distro | Out-Null
    Start-Sleep -Seconds 2
    & wsl.exe -d $Distro -u root -- bash -lc 'systemctl is-system-running --wait >/dev/null 2>&1 || true'
}

function Get-RepoRootInWsl {
    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    $wslPath = (& wsl.exe -d $Distro -u root -- wslpath -a -u $repoRoot 2>$null | Select-Object -First 1).Trim()
    if (-not $wslPath) { throw '[FAIL] Could not translate the IZAKHONO repository path into WSL.' }
    return $wslPath
}

function Install-IzakhonoStack {
    Write-Stage 'Install owner-controlled IZAKHONO Launch Stack'
    $wslRoot = Get-RepoRootInWsl
    $command = "cd $(Quote-Bash $wslRoot) && bash scripts/launch-stack/first-host.sh"
    & wsl.exe -d $Distro -u root -- bash -lc $command
    if ($LASTEXITCODE -ne 0) { throw '[FAIL] IZAKHONO first-host installation failed inside WSL.' }
}

function Get-WslIPv4 {
    $raw = (& wsl.exe -d $Distro -u root -- bash -lc "hostname -I | tr ' ' '\n' | grep -E '^[0-9]+(\\.[0-9]+){3}$' | head -n1" 2>$null | Select-Object -First 1)
    if (-not $raw) { throw '[FAIL] Could not discover the WSL IPv4 address.' }
    return $raw.Trim()
}

function Install-PortProxyRefresh {
    Write-Stage 'Bridge Windows ports 80/443 to IZAKHONO'
    $programData = Join-Path $env:ProgramData 'IZAKHONO'
    New-Item -ItemType Directory -Force -Path $programData | Out-Null
    $refreshPath = Join-Path $programData 'refresh-owner-host.ps1'
    $escapedDistro = $Distro.Replace("'", "''")
    $refresh = @"
`$ErrorActionPreference = 'Stop'
`$distro = '$escapedDistro'
& wsl.exe -d `$distro -u root -- bash -lc 'systemctl start docker >/dev/null 2>&1 || true; cd /opt/izakhono/launch-stack && docker compose up -d >/dev/null 2>&1 || true'
`$ip = (& wsl.exe -d `$distro -u root -- bash -lc "hostname -I | tr ' ' '\n' | grep -E '^[0-9]+(\\.[0-9]+){3}`$' | head -n1" | Select-Object -First 1).Trim()
if (-not `$ip) { throw 'No WSL IPv4 address available.' }
foreach (`$port in 80,443) {
    & netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=`$port 2>`$null | Out-Null
    & netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=`$port connectaddress=`$ip connectport=`$port | Out-Null
}
"@
    Set-Content -Path $refreshPath -Value $refresh -Encoding UTF8

    foreach ($name in 'IZAKHONO HTTP','IZAKHONO HTTPS') {
        Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
    }
    New-NetFirewallRule -DisplayName 'IZAKHONO HTTP' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 80 -Profile Any | Out-Null
    New-NetFirewallRule -DisplayName 'IZAKHONO HTTPS' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 443 -Profile Any | Out-Null

    & PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File $refreshPath
    if ($LASTEXITCODE -ne 0) { throw '[FAIL] Could not establish the Windows-to-WSL port bridge.' }

    $taskName = 'IZAKHONO Owner Host Refresh'
    $userId = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    $action = New-ScheduledTaskAction -Execute 'PowerShell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File $(Quote-Argument $refreshPath)"
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
    $principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Highest
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
    Write-Host "Windows now forwards HTTP/HTTPS to WSL address $(Get-WslIPv4)."
}

function Get-LanIPv4 {
    $config = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address } | Select-Object -First 1
    if (-not $config) { return $null }
    return $config.IPv4Address.IPAddress
}

function Try-UpnpMapping {
    if (-not $AttemptRouterMapping) { return }
    Write-Stage 'Attempt router publication (UPnP, if supported)'
    try {
        $lanIp = Get-LanIPv4
        if (-not $lanIp) { throw 'No LAN IPv4 address with a default gateway was found.' }
        $upnp = New-Object -ComObject HNetCfg.NATUPnP
        $maps = $upnp.StaticPortMappingCollection
        if ($null -eq $maps) { throw 'The router does not expose a UPnP port-mapping collection.' }
        foreach ($port in 80,443) {
            try { $maps.Remove($port, 'TCP') } catch { }
            $description = if ($port -eq 80) { 'IZAKHONO HTTP' } else { 'IZAKHONO HTTPS' }
            [void]$maps.Add($port, 'TCP', $port, $lanIp, $true, $description)
        }
        Write-Host "[PASS] Router accepted TCP 80/443 mappings to $lanIp."
        Write-Host 'This still does not prove a branded domain or public HTTPS; the application launch gate must prove those separately.'
    } catch {
        Write-Warning "Automatic router mapping was not available: $($_.Exception.Message)"
        Write-Warning 'IZAKHONO remains healthy locally. Public launch will stay fail-closed until the network exposes TCP 80/443 or another owner-approved edge is used.'
    }
}

function Show-Status {
    Write-Stage 'IZAKHONO owner-host status'
    if (-not (Test-DistroInstalled $Distro)) {
        Write-Host '[NOT READY] Ubuntu/WSL owner host is not installed.'
        return
    }
    & wsl.exe -d $Distro -u root -- bash -lc 'if [ -x /opt/izakhono/bin/health-check.sh ]; then /opt/izakhono/bin/health-check.sh; else echo "[NOT READY] IZAKHONO Launch Stack is not installed."; fi'
    Write-Host "`nWindows port proxy:"
    & netsh interface portproxy show v4tov4
    Write-Host "`nImportant: local health and Windows port forwarding do not by themselves prove public internet reachability. Commercial publication remains gated by the real application domain and readiness checks."
}

Ensure-Admin
Ensure-WindowsCapability

if ($StatusOnly) {
    Show-Status
    exit 0
}

Write-Stage 'Prepare Windows as our first owner-controlled compute host'
Write-Host 'This uses built-in WSL2 plus our IZAKHONO Launch Stack. No cloud/VPS password, SSH key, PayFast secret or application credential is requested.'

$restartNeeded = $false
$restartNeeded = (Enable-FeatureIfNeeded 'Microsoft-Windows-Subsystem-Linux') -or $restartNeeded
$restartNeeded = (Enable-FeatureIfNeeded 'VirtualMachinePlatform') -or $restartNeeded
$restartNeeded = (Ensure-Distro) -or $restartNeeded

if ($restartNeeded -and -not $Resume) {
    Register-ResumeTask
    if ($NoRestart) {
        Write-Warning 'A Windows restart is required. Continuation is already registered for the next logon.'
        exit 10
    }
    Write-Host 'Windows must restart once to finish enabling the owner-host foundation.'
    Write-Host 'IZAKHONO will continue automatically after you sign back in.'
    shutdown.exe /r /t 20 /c "IZAKHONO owner-host setup will continue automatically after restart."
    exit 0
}

if (-not (Test-DistroInstalled $Distro)) {
    throw '[FAIL] WSL is enabled but the Ubuntu distribution is still unavailable. Restart Windows and run this launcher again.'
}

Remove-ResumeTask
Enable-WslSystemd
Install-IzakhonoStack
Install-PortProxyRefresh
Try-UpnpMapping
Show-Status

Write-Host "`n[PASS] THIS WINDOWS COMPUTER IS NOW AN IZAKHONO OWNER HOST FOUNDATION." -ForegroundColor Green
Write-Host 'Applications are not called commercially live until their chosen domain resolves here, public HTTPS passes, and every declared commercial readiness gate returns true.'
Write-Host 'Use our own launch command inside the host for each project: /opt/izakhono/bin/launch-project.sh'
