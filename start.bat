@echo off
title cMPLi Be - Gamification Local Server
echo ========================================================
echo   Starting cMPLi Be Gamification Local Server...
echo ========================================================
echo.

:: Check if node is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b
)

:: Install dependencies if node_modules missing
if not exist "node_modules\" (
    echo [INFO] Installing required dependencies...
    call npm install
)

echo [OK] Launching Web Service at http://localhost:3000
echo.
timeout /t 2 /nobreak >nul
start http://localhost:3000

node server.js
pause
