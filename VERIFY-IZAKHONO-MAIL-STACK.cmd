@echo off
setlocal
cd /d "%~dp0"
node infra\mail-stack\verify.mjs
if errorlevel 1 exit /b %errorlevel%
node infra\mail-stack\render-addresses.mjs
if errorlevel 1 exit /b %errorlevel%
echo.
echo IZAKHONO Mail Stack registry verified and address register rendered.
echo DNS, MX, SPF, DKIM, DMARC and send/receive checks are still required before LIVE VERIFIED.
