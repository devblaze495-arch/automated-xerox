@echo off
setlocal EnableDelayedExpansion

:: Check for Administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] This script requires Administrator privileges.
    echo Please right-click uninstall-service.bat and select 'Run as administrator'.
    pause
    exit /b 1
)

set SERVICE_NAME=CampusPrintAgent

echo [INFO] Stopping Windows Service '%SERVICE_NAME%'...
sc.exe stop "%SERVICE_NAME%" >nul 2>&1

echo [INFO] Removing Windows Service '%SERVICE_NAME%'...
sc.exe delete "%SERVICE_NAME%"

echo.
echo ====================================================================
echo [SUCCESS] CampusPrintAgent Windows Service has been uninstalled.
echo ====================================================================
pause

