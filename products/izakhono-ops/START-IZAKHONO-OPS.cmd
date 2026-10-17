@echo off
setlocal
where wsl.exe >nul 2>&1 || (echo WSL is required.&exit /b 1)
wsl.exe bash -lc "python3 /mnt/c/izakhono/products/izakhono-ops/ops.py"
endlocal
