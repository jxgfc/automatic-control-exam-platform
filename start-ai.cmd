@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is required to run the AI question bank.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)

set "PORT=4173"
echo Starting the Automatic Control AI Question Bank...
echo Local address: http://127.0.0.1:%PORT%
echo For phone/tablet access, use the computer's IPv4 address on the same Wi-Fi network.
start "" "http://127.0.0.1:%PORT%"
echo Keep this window open while using AI generation.
node server.js

echo.
echo The local service has stopped.
pause
