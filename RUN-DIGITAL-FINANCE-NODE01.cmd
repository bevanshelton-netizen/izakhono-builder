@echo off
setlocal EnableExtensions
title IZAKHONO DIGITAL FINANCE - NODE01 CUTOVER
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0RUN-DIGITAL-FINANCE-NODE01.ps1" %*
exit /b %ERRORLEVEL%
