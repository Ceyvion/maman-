#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v python3.12 >/dev/null 2>&1; then
  echo "python3.12 not found. Install it first (Apple Silicon: brew install python@3.12)."
  exit 1
fi
if [ ! -d .venv ]; then
  python3.12 -m venv .venv
fi
source .venv/bin/activate
python -m pip install --upgrade pip >/dev/null
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
