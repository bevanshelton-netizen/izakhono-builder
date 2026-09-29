@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0START-IZAKHONO-GROWTH-ENGINE-NODE01.ps1"
exit /b %ERRORLEVEL%
