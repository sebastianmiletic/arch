#!/bin/bash
# AI Terminal Studio Launcher for macOS
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Install dependencies if needed
if [ ! -d "$DIR/server/node_modules" ]; then
  echo "Installing server dependencies..."
  cd "$DIR/server" && npm install
  cd "$DIR"
fi

# Start the application
npx electron . &
