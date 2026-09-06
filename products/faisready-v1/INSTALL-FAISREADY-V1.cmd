@echo off
setlocal EnableExtensions
title FAISReady v1 - IZAKHONO WORK OWNER INSTALL

echo ============================================================
echo              FAISReady v1 - OWNER INSTALL
echo ============================================================
echo.
echo Installs the reviewed FAISReady v1 launch product into the
echo local IZAKHONO WORK owner workspace and validates the result.
echo.

set "BASE=http://127.0.0.1:9393"
set "ROOT=%LOCALAPPDATA%\IzakhonoWork\data\projects\FAISReady-v1"
set "TEMPBUILD=%TEMP%\FAISREADY-V1-%RANDOM%"
set "SRC=https://raw.githubusercontent.com/bevanshelton-netizen/izakhono-builder/64b41d6a9e5db233a2524771249c7a50a94f634d/products/faisready-v1"

echo [1/5] Checking IZAKHONO WORK v1...
powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; $h=Invoke-RestMethod -Uri '%BASE%/healthz' -TimeoutSec 4; if(-not $h.ok -or $h.version -ne '1.0.0'){ throw 'IZAKHONO WORK v1.0.0 is not running.' }; Write-Host 'IZAKHONO_WORK_V1=READY'"
if errorlevel 1 (
  echo.
  echo IZAKHONO WORK v1 is not reachable. Attempting owner startup...
  if exist "%LOCALAPPDATA%\IzakhonoWork\portable-1.0.0\START-IZAKHONO-WORK.ps1" (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LOCALAPPDATA%\IzakhonoWork\portable-1.0.0\START-IZAKHONO-WORK.ps1" -NoBrowser
  )
  powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; $h=Invoke-RestMethod -Uri '%BASE%/healthz' -TimeoutSec 8; if(-not $h.ok -or $h.version -ne '1.0.0'){ throw 'IZAKHONO WORK v1.0.0 is still unavailable.' }"
  if errorlevel 1 goto :fail
)

echo [2/5] Downloading reviewed FAISReady v1 files...
if exist "%TEMPBUILD%" rmdir /s /q "%TEMPBUILD%"
mkdir "%TEMPBUILD%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $files=@('index.html','styles.css','app.js','README.md','RELEASE-CHECKLIST.md','PAYMENT-INTEGRATION.md'); foreach($f in $files){ Invoke-WebRequest -UseBasicParsing -Uri ('%SRC%/'+$f) -OutFile (Join-Path '%TEMPBUILD%' $f) }; $assets=Join-Path '%TEMPBUILD%' 'assets'; New-Item -ItemType Directory -Force -Path $assets | Out-Null; 0..3 | ForEach-Object { Invoke-WebRequest -UseBasicParsing -Uri ('%SRC%/assets/rainbow-clean-'+$_+'.b64') -OutFile (Join-Path $assets ('rainbow-clean-'+$_+'.b64')) }"
if errorlevel 1 goto :fail

echo [3/5] Backing up any existing local FAISReady project...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $root='%ROOT%'; if(Test-Path $root){ $files=Get-ChildItem $root -Force | Where-Object { $_.Name -ne '.izakhono' }; if($files){ $cp=Join-Path $root '.izakhono\checkpoints'; New-Item -ItemType Directory -Force -Path $cp | Out-Null; $stamp=Get-Date -Format 'yyyyMMdd-HHmmss'; $zip=Join-Path $cp ($stamp+'-before-reviewed-faisready-v1.zip'); Compress-Archive -Path ($files.FullName) -DestinationPath $zip -Force } }"
if errorlevel 1 goto :fail

echo [4/5] Installing into the owner-controlled workspace...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $root='%ROOT%'; New-Item -ItemType Directory -Force -Path $root | Out-Null; New-Item -ItemType Directory -Force -Path (Join-Path $root '.izakhono\checkpoints') | Out-Null; Copy-Item '%TEMPBUILD%\*' $root -Force -Recurse; $meta=Join-Path $root '.izakhono\project.json'; if(-not (Test-Path $meta)){ @{name='FAISReady-v1';created_at=[int][double]::Parse((Get-Date -UFormat %%s));initial_spec='Reviewed FAISReady v1 owner launch product'} | ConvertTo-Json | Set-Content -Path $meta -Encoding UTF8 }"
if errorlevel 1 goto :fail

echo [5/5] Validating and opening local preview...
powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; $v=Invoke-RestMethod -Uri '%BASE%/api/projects/FAISReady-v1/validate' -TimeoutSec 10; if(-not $v.ok){ $v | ConvertTo-Json -Depth 6; throw 'FAISReady validation failed.' }; $t=Invoke-RestMethod -Uri '%BASE%/api/projects/FAISReady-v1/tree' -TimeoutSec 10; $count=@($t.items | Where-Object { $_.type -eq 'file' }).Count; if($count -lt 10){ throw 'FAISReady project is incomplete.' }; Write-Host ''; Write-Host 'FAISREADY_V1_OWNER_BUILD=PASS'; Write-Host ('Files: '+$count); Write-Host 'Validation: PASS';"
if errorlevel 1 goto :fail

start "" "%BASE%/preview/FAISReady-v1/"
echo.
echo ============================================================
echo                FAISReady v1 BUILD PASSED
echo ============================================================
echo.
echo The real launch product is installed inside IZAKHONO WORK.
echo Payments remain disabled until separately verified.
echo.
rmdir /s /q "%TEMPBUILD%" >nul 2>&1
pause
exit /b 0

:fail
echo.
echo ============================================================
echo               FAISReady v1 INSTALL STOPPED
echo ============================================================
echo.
echo No payment or security settings were changed.
echo Leave this window open and photograph the final error.
echo.
pause
exit /b 1
