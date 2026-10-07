# Preview launcher for Windows (PowerShell)
# Starts the OAuth Helper on localhost:3000 and opens in default browser

Write-Host "🚀 Starting Roo OAuth Helper Preview..." -ForegroundColor Cyan
Write-Host ""

# Navigate to script directory
Set-Location $PSScriptRoot

# Check if node is installed
$nodeInstalled = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeInstalled) {
    Write-Host "❌ Node.js is not installed!" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/"
    Read-Host "Press Enter to exit"
    exit 1
}

$nodeVersion = node --version
Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green

# Check if dependencies are installed
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
} else {
    Write-Host "✅ Dependencies already installed" -ForegroundColor Green
}

# Check if .env file exists
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.bridge.example") {
        Write-Host "⚠️  No .env file found. You may need to configure environment variables." -ForegroundColor Yellow
        Write-Host "   See .env.bridge.example for reference."
    }
}

Write-Host ""
Write-Host "🌐 Starting OAuth Helper server on http://localhost:3000" -ForegroundColor Cyan
Write-Host "   Press Ctrl+C to stop the server"
Write-Host ""

# Open browser after a short delay
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 2
    Start-Process "http://localhost:3000"
} | Out-Null

# Start the OAuth server
node oauth-server.js
