#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")" && pwd)"
cd "$project_dir"
if [ ! -d .venv ]; then python3 -m venv .venv; fi
if ! .venv/bin/python -c "import fastapi, alembic, sqlalchemy, cv2, sklearn, pymysql" >/dev/null 2>&1 || ! cmp -s backend/requirements.txt .venv/.ours-requirements.txt; then
  .venv/bin/python -m pip install -r backend/requirements.txt
  cp backend/requirements.txt .venv/.ours-requirements.txt
fi
if [ ! -d node_modules ] || ! cmp -s package-lock.json node_modules/.ours-package-lock.json; then
  npm ci --no-audit --no-fund
  cp package-lock.json node_modules/.ours-package-lock.json
fi
(cd backend && ../.venv/bin/python run.py) &
backend_pid=$!
npm run dev -- --host 0.0.0.0 --port 5173 &
frontend_pid=$!
trap 'kill "$backend_pid" "$frontend_pid" 2>/dev/null || true' EXIT INT TERM
echo "Open http://localhost:5173"
wait
