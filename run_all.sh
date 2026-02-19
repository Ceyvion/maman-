#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v python3.12 >/dev/null 2>&1; then
  echo "python3.12 not found. Install with: brew install python@3.12"
  exit 1
fi
if [ ! -d .venv ]; then
  python3.12 -m venv .venv
fi
source .venv/bin/activate
python -m pip install --upgrade pip >/dev/null
python -m pip install -r requirements.txt >/dev/null
mkdir -p .logs
pkill -f "uvicorn app.main:app" >/dev/null 2>&1 || true
pkill -f "http.server 5173" >/dev/null 2>&1 || true
nohup python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 > .logs/api.log 2>&1 &
nohup python3 -m http.server 5173 --bind 127.0.0.1 --directory frontend > .logs/frontend.log 2>&1 &
sleep 1
open http://127.0.0.1:5173
printf "API: http://127.0.0.1:8000\nUI:  http://127.0.0.1:5173\nLogs: %s/.logs\n" "$(pwd)"
