#!/bin/bash

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Start backend in a new Terminal tab
osascript <<EOF
tell application "Terminal"
  activate
  do script "cd '$ROOT/backend' && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
end tell
EOF

# Start frontend in another Terminal tab
osascript <<EOF
tell application "Terminal"
  activate
  tell application "System Events" to keystroke "t" using command down
  delay 0.5
  do script "cd '$ROOT/frontend' && npm run dev" in front window
end tell
EOF

echo "Started backend (http://localhost:8000) and frontend (http://localhost:3000)"
