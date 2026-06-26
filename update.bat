@echo off
REM m-clock UPDATE + RUN for Windows.
REM Pulls the latest version from GitHub, then starts the server.
REM (Only works if you got m-clock with "git clone" — see the README.)
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo Git is not installed. Install it from https://git-scm.com then try again.
  pause
  exit /b 1
)

echo Updating m-clock from GitHub...
git pull
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install it from https://nodejs.org ^(version 18+^).
  pause
  exit /b 1
)

echo Starting m-clock... keep this window open. Close it to stop.
start "" "http://localhost:3000/control"
node server.js
pause
