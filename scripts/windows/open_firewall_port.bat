@echo off
REM Open Windows Firewall port 8081 for FastAPI backend
REM This script must be run as Administrator

echo ========================================
echo Opening Windows Firewall Port 8081
echo ========================================
echo.

REM Try PowerShell method first (more reliable)
powershell -Command "& {if (Get-NetFirewallRule -DisplayName 'FastAPI Backend Port 8081' -ErrorAction SilentlyContinue) { Remove-NetFirewallRule -DisplayName 'FastAPI Backend Port 8081' -ErrorAction SilentlyContinue }; New-NetFirewallRule -DisplayName 'FastAPI Backend Port 8081' -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow -Profile Domain,Private,Public -Description 'Allow FastAPI backend on port 8081' }"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Port 8081 has been opened in Windows Firewall!
    echo You can now access the backend from other PCs on the network.
    echo.
) else (
    echo.
    echo [ERROR] Failed to open port 8081.
    echo Please run this script as Administrator:
    echo   1. Right-click this file
    echo   2. Select "Run as administrator"
    echo.
    echo OR manually open Windows Firewall and add an inbound rule for port 8081
    echo.
)

pause
