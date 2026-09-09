#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$Distro = 'Ubuntu',
    [string]$Repository = 'https://github.com/bevanshelton-netizen/allegro-vibez'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

if ($Repository -notmatch '^https://github\.com/bevanshelton-netizen/[A-Za-z0-9._-]+$') {
    throw '[FAIL] Repository must be inside the approved bevanshelton-netizen GitHub namespace.'
}

$distros = @(wsl.exe -l -q 2>$null | ForEach-Object { ($_ -replace "`0", '').Trim() } | Where-Object { $_ })
if ($distros -notcontains $Distro) {
    throw '[FAIL] IZAKHONO owner host is not installed yet. Run START-IZAKHONO-OWNER-HOST.cmd first.'
}

& wsl.exe -d $Distro -u root -- bash -lc 'test -x /opt/izakhono/bin/install-actions-runner.sh && docker info >/dev/null 2>&1'
if ($LASTEXITCODE -ne 0) {
    throw '[FAIL] IZAKHONO owner-host tools are not ready. Re-run START-IZAKHONO-OWNER-HOST.cmd from the current Builder package first.'
}

Write-Host ''
Write-Host 'IZAKHONO ACTIONS RUNNER' -ForegroundColor Cyan
Write-Host 'This connects NODE 01 to the queued owner-controlled deployment workflow.'
Write-Host 'The token is short-lived and will not be written to disk by this launcher.'
Write-Host ''

$secure = Read-Host 'Paste the GitHub self-hosted runner registration token' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    if ($token -notmatch '^[A-Za-z0-9_-]{20,200}$') {
        throw '[FAIL] The supplied runner token does not have the expected format.'
    }

    $command = "read -r IZAKHONO_GITHUB_RUNNER_TOKEN; export IZAKHONO_GITHUB_RUNNER_TOKEN; exec /opt/izakhono/bin/install-actions-runner.sh '$Repository'"
    $token | & wsl.exe -d $Distro -u root -- bash -lc $command
    if ($LASTEXITCODE -ne 0) {
        throw "[FAIL] IZAKHONO Actions runner setup stopped with exit code $LASTEXITCODE."
    }
} finally {
    if ($ptr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
    $token = $null
    $secure = $null
}

Write-Host ''
Write-Host '[PASS] NODE 01 is registered as an IZAKHONO self-hosted deployment runner.' -ForegroundColor Green
Write-Host 'Return to the ALLEGRO workflow: the queued production cutover can now be picked up by NODE 01.'
