#!/bin/bash
set -e

# Ensure python dependencies are available (Render caches build step but this is safe)
pip install -r ml-service/requirements.txt >/tmp/ml-install.log 2>&1 || true

# Start ML service on internal port 5001
python ml-service/app.py &
ML_PID=$!

# Start Node/Express app (Bind to $PORT per Render requirements)
npm start &
NODE_PID=$!

# Wait for exits to propagate
wait $ML_PID
wait $NODE_PID

