#!/bin/bash
# m-clock launcher for Linux — run this file to start the server.
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Please install it (version 18+) then run this again."
  exit 1
fi

( sleep 1.5; xdg-open "http://localhost:3000/control" >/dev/null 2>&1 ) &

echo "Starting m-clock... keep this window open. Press Ctrl+C to stop."
node server.js
