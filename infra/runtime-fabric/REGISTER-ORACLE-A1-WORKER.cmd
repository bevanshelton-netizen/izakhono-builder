@echo off
setlocal
if "%~1"=="" (
  echo Usage: REGISTER-ORACLE-A1-WORKER.cmd HOSTNAME_OR_IP [SSH_USER] [SSH_PORT]
  exit /b 2
)
set "HOST=%~1"
set "USER=%~2"
set "PORT=%~3"
if "%USER%"=="" set "USER=ubuntu"
if "%PORT%"=="" set "PORT=22"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0REGISTER-ORACLE-A1-WORKER.ps1" -HostName "%HOST%" -SshUser "%USER%" -SshPort %PORT%
exit /b %ERRORLEVEL%
