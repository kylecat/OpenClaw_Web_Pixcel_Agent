#!/usr/bin/env bash
# Stop all backend and frontend dev processes

echo "[stop-all] stopping backend (port 3000)..."
fuser -k 3000/tcp 2>/dev/null && echo "  port 3000 released" || echo "  port 3000 was not in use"

echo "[stop-all] stopping frontend (port 5173/5174)..."
fuser -k 5173/tcp 2>/dev/null && echo "  port 5173 released" || true
fuser -k 5174/tcp 2>/dev/null && echo "  port 5174 released" || true

echo "[stop-all] done."
