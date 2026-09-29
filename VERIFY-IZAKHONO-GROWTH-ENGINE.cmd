@echo off
setlocal
set ROOT=%~dp0
pushd "%ROOT%products\izakhono-growth-engine" || exit /b 1
where node >nul 2>nul || (echo Node.js is required.& exit /b 1)
node --check server.mjs || exit /b 1
node --check public\app.js || exit /b 1
node --test tests\*.test.mjs || exit /b 1
popd
echo IZAKHONO Growth Engine verification PASSED.
exit /b 0
