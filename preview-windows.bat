@echo off
REM Preview launcher for Windows (Command Prompt)
REM Starts the OAuth Helper on localhost:3000 and opens in default browser

echo 🚀 Starting Roo OAuth Helper Preview...
echo.

REM Navigate to script directory
cd /d "%~dp0"

REM Check if node is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js found: %NODE_VERSION%

REM Check if dependencies are installed
if not exist "node_modules\" (
    echo 📦 Installing dependencies...
    call npm install
) else (
    echo ✅ Dependencies already installed
)

REM Check if .env file exists
if not exist ".env" (
    if exist ".env.bridge.example" (
        echo ⚠️  No .env file found. You may need to configure environment variables.
        echo    See .env.bridge.example for reference.
    )
)

echo.
echo 🌐 Starting OAuth Helper server on http://localhost:3000
echo    Press Ctrl+C to stop the server
echo.

REM Open browser after a short delay
start "" /b timeout /t 2 /nobreak >nul && start http://localhost:3000

REM Start the OAuth server
node oauth-server.js
