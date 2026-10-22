# IZAKHONO MAIL v1 — NODE01 launcher
# Run on the authorized NODE01/owner machine after extracting this package.
$ErrorActionPreference='Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host 'IZAKHONO MAIL v1 — NODE01 launcher' -ForegroundColor Cyan
if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) { throw 'WSL is required on this Windows host.' }
$linuxRoot = wsl.exe -d Ubuntu-24.04 sh -lc 'printf %s "$HOME"'
$linuxRoot = $linuxRoot.Trim()
if (-not $linuxRoot) { throw 'Ubuntu-24.04 WSL distribution is not available.' }
$archive = Join-Path $env:TEMP 'izakhono-mail-v1.tgz'
tar -czf $archive -C $root .
$linuxArchive = wsl.exe -d Ubuntu-24.04 wslpath -a "$archive"
wsl.exe -d Ubuntu-24.04 sh -lc "mkdir -p ~/izakhono-mail && tar -xzf '$linuxArchive' -C ~/izakhono-mail"
wsl.exe -d Ubuntu-24.04 sh -lc 'cd ~/izakhono-mail && test -f .env || cp .env.example .env && echo "Package staged at ~/izakhono-mail. Edit .env with the real mailbox password, then run ./ops/bootstrap.sh"'
Write-Host 'Package staged on NODE01. No production mail was claimed without the host network/DNS gates.' -ForegroundColor Yellow
