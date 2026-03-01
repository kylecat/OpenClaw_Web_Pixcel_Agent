#!/usr/bin/env bash
# Start React + Vite frontend dev server (http://localhost:5173)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../frontend"

echo "[frontend] starting on http://localhost:5173 ..."
npm run dev
