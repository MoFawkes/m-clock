@echo off
REM AQI Clock launcher for Windows - double-click this file to start the server.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Please install it from https://nodejs.org ^(version 18+^), then double-click this file again.
  pause
  exit /b 1
)

echo Starting AQI Clock... keep this window open. Close it to stop.
start "" "http://localhost:3000/control"
node server.js
pause
