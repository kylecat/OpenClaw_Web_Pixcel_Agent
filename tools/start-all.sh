#!/usr/bin/env bash
# Start backend + frontend concurrently in background tabs
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[start-all] launching backend and frontend..."

# Start backend in background, pipe logs to /tmp/backend.log
bash "$SCRIPT_DIR/start-backend.sh" > /tmp/openclaw-backend.log 2>&1 &
BACKEND_PID=$!
echo "[start-all] backend PID: $BACKEND_PID  (log: /tmp/openclaw-backend.log)"

# Start frontend in foreground (Ctrl+C will stop both via trap)
cleanup() {
  echo ""
  echo "[start-all] stopping backend (PID $BACKEND_PID)..."
  kill "$BACKEND_PID" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

bash "$SCRIPT_DIR/start-frontend.sh"
