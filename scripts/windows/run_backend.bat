@echo off
setlocal enableextensions enabledelayedexpansion

cd /d "%~dp0..\.." 2>nul

if not exist .venv (
  echo [Backend] No virtualenv found. Creating one now...
  call scripts\windows\setup_backend.bat || (
    echo [Backend] Failed to create virtualenv.
    exit /b 1
  )
)

REM Check Python version inside venv; recreate if it's 3.14 which breaks deps
for /f "delims=" %%V in ('cmd /c .venv\Scripts\python -c "import sys;print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2^>nul') do set VENV_PY=%%V
if "%VENV_PY%"=="3.14" (
  echo [Backend] Detected Python %VENV_PY% in venv; recreating with Python 3.11/3.10...
  rmdir /s /q .venv
  call scripts\windows\setup_backend.bat || (
    echo [Backend] Failed to recreate virtualenv.
    exit /b 1
  )
)

call .venv\Scripts\activate

set PORT=8081
for /f "tokens=2 delims==" %%A in ('findstr /B /C:"BACKEND_PORT=" backend\.env 2^>nul') do set PORT=%%A

echo [Backend] Installing/Updating backend requirements...
python -m pip install --upgrade pip setuptools wheel
pip install --upgrade --upgrade-strategy eager -r backend\requirements.txt || (
  echo [Backend] Failed to install requirements. Aborting.
  exit /b 1
)

echo [Backend] Starting API on port %PORT% ...
python -m uvicorn app.main:app --reload --port %PORT% --host 0.0.0.0 --app-dir backend


