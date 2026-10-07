#!/bin/bash
# Preview launcher for macOS
# Starts the OAuth Helper on localhost:3000 and opens in default browser

set -e

echo "🚀 Starting Roo OAuth Helper Preview..."
echo ""

# Navigate to script directory
cd "$(dirname "$0")"

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
else
    echo "✅ Dependencies already installed"
fi

# Check if .env file exists, create from example if not
if [ ! -f ".env" ] && [ -f ".env.bridge.example" ]; then
    echo "⚠️  No .env file found. You may need to configure environment variables."
    echo "   See .env.bridge.example for reference."
fi

echo ""
echo "🌐 Starting OAuth Helper server on http://localhost:3000"
echo "   Press Ctrl+C to stop the server"
echo ""

# Open browser after a short delay
(sleep 2 && open "http://localhost:3000") &

# Start the OAuth server
node oauth-server.js
