#!/usr/bin/env bash
# Show running status of backend and frontend

check_port() {
  local name=$1
  local port=$2
  local url=$3
  if fuser "$port/tcp" > /dev/null 2>&1; then
    local pid
    pid=$(fuser "$port/tcp" 2>/dev/null | tr -d ' ')
    echo "  [✓] $name  →  $url  (PID $pid)"
  else
    echo "  [✗] $name  →  not running (port $port)"
  fi
}

echo ""
echo "=== OpenClaw PixelAgent — Process Status ==="
check_port "backend  (NestJS)" 3000 "http://localhost:3000"
check_port "frontend (Vite)  " 5173 "http://localhost:5173"
check_port "frontend (Vite)  " 5174 "http://localhost:5174"
echo ""

# Quick health check if backend is up
if fuser 3000/tcp > /dev/null 2>&1; then
  result=$(curl -s --max-time 2 http://localhost:3000/health 2>/dev/null)
  if [ -n "$result" ]; then
    echo "  /health → $result"
  fi
fi
echo ""
