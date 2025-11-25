#!/bin/bash
set -e

echo "📌 Installing Python dependencies..."
pip install -r ml-service/requirements.txt

echo "🚀 Starting ML service..."
python ml-service/app.py &
ML_PID=$!

echo "🚀 Starting Node backend..."
# Node must bind to $PORT
export PORT=${PORT:-5000}
npm start &
NODE_PID=$!

wait $ML_PID
wait $NODE_PID
