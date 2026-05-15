@echo off
setlocal
cd /d "%~dp0"
echo.
echo Starting Striker Carrom app on http://localhost:8080
echo.
echo Keep this window open while using the app.
echo Press Ctrl+C to stop the server.
echo.
py -3 -m http.server 8080
if errorlevel 1 (
  echo.
  echo Python launcher failed. Trying python instead...
  python -m http.server 8080
)
pause
