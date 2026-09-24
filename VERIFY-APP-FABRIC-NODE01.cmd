@echo off
setlocal EnableExtensions
title IZAKHONO APP FABRIC - VERIFY NODE01
cd /d "%~dp0"
where wsl.exe >nul 2>&1 || (echo [STOP] WSL is not available.& exit /b 1)
set DISTRO=Ubuntu
for /f "usebackq delims=" %%I in (`wsl.exe -d %DISTRO% -- wslpath -a "%CD%"`) do set LINUX_ROOT=%%I
wsl.exe -d %DISTRO% -u root -- bash "%LINUX_ROOT%/infra/app-fabric-runtime/verify-node01.sh"
exit /b %ERRORLEVEL%
