@echo off
cd /d "%~dp0..\.." 2>nul
echo Rebuilding backend image and restarting container...
docker-compose up -d --build backend
if %errorlevel% equ 0 (
  echo Backend rebuilt and running. API: http://localhost:8081
) else (
  echo Rebuild failed. Check Docker is running and docker-compose is available.
  exit /b 1
)
