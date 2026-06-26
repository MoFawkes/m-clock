#!/bin/bash
# m-clock launcher for macOS — double-click this file to start the server.
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Please install it from https://nodejs.org (version 18+),"
  echo "then double-click this file again."
  read -r -p "Press Enter to close..."
  exit 1
fi

# Open the control panel in the browser shortly after the server starts.
( sleep 1.5; open "http://localhost:3000/control" >/dev/null 2>&1 ) &

echo "Starting m-clock... keep this window open. Close it to stop."
node server.js
read -r -p "Server stopped. Press Enter to close..."
