#!/bin/bash
# AQI Clock UPDATE + RUN for macOS/Linux.
# Pulls the latest version from GitHub, then starts the server.
# (Only works if you got AQI Clock with "git clone" — see the README.)
cd "$(dirname "$0")" || exit 1

if ! command -v git >/dev/null 2>&1; then
  echo "Git is not installed. Install it from https://git-scm.com then try again."
  read -r -p "Press Enter to close..."
  exit 1
fi

echo "Updating AQI Clock from GitHub..."
git pull
echo

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install it from https://nodejs.org (version 18+)."
  read -r -p "Press Enter to close..."
  exit 1
fi

( sleep 1.5; (open "http://localhost:3000/control" || xdg-open "http://localhost:3000/control") >/dev/null 2>&1 ) &
echo "Starting AQI Clock... keep this window open. Close it to stop."
node server.js
read -r -p "Server stopped. Press Enter to close..."
