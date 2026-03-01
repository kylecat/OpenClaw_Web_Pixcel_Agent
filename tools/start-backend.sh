#!/usr/bin/env bash
# Start NestJS backend dev server (http://localhost:3000)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../backend"

echo "[backend] starting on http://localhost:3000 ..."
npm run start:dev
