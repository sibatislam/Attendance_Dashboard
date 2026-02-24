@echo off
setlocal enableextensions enabledelayedexpansion

cd /d "%~dp0..\.." 2>nul

echo [Setup] Ensuring backend environment and dependencies...
call scripts\windows\setup_backend.bat

echo [Start] Launching Backend and Frontend in separate windows...
start "Backend" cmd /k scripts\windows\run_backend.bat
start "Frontend" cmd /k scripts\windows\run_frontend.bat

echo [Start] Done. Backend: http://localhost:8081  Frontend: http://localhost:5173
exit /b 0


