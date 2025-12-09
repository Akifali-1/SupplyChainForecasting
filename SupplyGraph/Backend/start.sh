#!/bin/bash
set -euo pipefail

# Choose python binary
PYTHON_BIN=${PYTHON_BIN:-python3}
if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  PYTHON_BIN=python
fi
if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "❌ Python is not available in this environment. Install it or set PYTHON_BIN."
  exit 1
fi

echo "🚀 Starting ML service with $PYTHON_BIN ..."
$PYTHON_BIN ml-service/app.py &
ML_PID=$!

echo "🚀 Starting Node backend..."
export PORT=${PORT:-5000}
npm start &
NODE_PID=$!

wait $ML_PID
wait $NODE_PID
