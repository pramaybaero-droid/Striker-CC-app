@echo off
setlocal
cd /d "%~dp0"
echo.
echo Starting Striker Carrom app on http://localhost:8001
echo.
py -3 -m http.server 8001
if errorlevel 1 python -m http.server 8001
pause
