#!/usr/bin/env bash
# Tail backend and frontend logs

BACKEND_LOG="/tmp/openclaw-backend.log"
FRONTEND_LOG="/tmp/frontend.log"

usage() {
  echo "Usage: $0 [backend|frontend|all]"
  echo "  backend   — tail backend log ($BACKEND_LOG)"
  echo "  frontend  — tail frontend log ($FRONTEND_LOG)"
  echo "  all       — tail both logs side by side (default)"
}

TARGET="${1:-all}"

case "$TARGET" in
  backend)
    [ -f "$BACKEND_LOG" ] || { echo "[logs] backend log not found: $BACKEND_LOG"; exit 1; }
    tail -f "$BACKEND_LOG"
    ;;
  frontend)
    [ -f "$FRONTEND_LOG" ] || { echo "[logs] frontend log not found: $FRONTEND_LOG"; exit 1; }
    tail -f "$FRONTEND_LOG"
    ;;
  all)
    files=()
    [ -f "$BACKEND_LOG" ]  && files+=("$BACKEND_LOG")
    [ -f "$FRONTEND_LOG" ] && files+=("$FRONTEND_LOG")
    if [ ${#files[@]} -eq 0 ]; then
      echo "[logs] no log files found. Start servers first with ./tools/start-all.sh"
      exit 1
    fi
    tail -f "${files[@]}"
    ;;
  *)
    usage; exit 1
    ;;
esac
