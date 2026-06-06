@echo off
setlocal EnableExtensions
title Mythos Voice Assistant
cd /d "%~dp0"

python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not on PATH.
    pause
    exit /b 1
)

if not exist ".env" (
    echo [ERROR] Missing .env — copy .env.example and add your API keys.
    pause
    exit /b 1
)

python -m pip install -r requirements.txt -q
if errorlevel 1 (
    echo [ERROR] pip install failed.
    pause
    exit /b 1
)

python main.py

echo.
if errorlevel 1 (
    echo [ERROR] Mythos exited with an error.
) else (
    echo Mythos shut down.
)
pause
