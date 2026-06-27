@echo off
REM AQI Clock UPDATE + RUN for Windows.
REM Pulls the latest version from GitHub, then starts the server.
REM (Only works if you got AQI Clock with "git clone" — see the README.)
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo Git is not installed. Install it from https://git-scm.com then try again.
  pause
  exit /b 1
)

echo Updating AQI Clock from GitHub...
git pull
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install it from https://nodejs.org ^(version 18+^).
  pause
  exit /b 1
)

echo Starting AQI Clock... keep this window open. Close it to stop.
start "" "http://localhost:3000/control"
node server.js
pause
