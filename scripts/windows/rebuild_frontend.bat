@echo off
cd /d "%~dp0..\.." 2>nul
echo Rebuilding frontend image and restarting container...
docker-compose up -d --build frontend
if %errorlevel% equ 0 (
  echo Frontend rebuilt and running. App: http://localhost:5173
) else (
  echo Rebuild failed. Check Docker is running and docker-compose is available.
  exit /b 1
)
