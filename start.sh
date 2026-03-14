#!/bin/bash

echo "🚀 Starting Pentaprotocol..."

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Start backend (Python/FastAPI)
cd "$SCRIPT_DIR/backend"
/opt/homebrew/bin/python3.14 -m uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
echo "✅ Backend running → http://localhost:8000"

# Start frontend (adjust folder name below if needed)
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!
echo "✅ Frontend running → http://localhost:5173"

echo ""
echo "Press Ctrl+C to stop both servers."
trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
