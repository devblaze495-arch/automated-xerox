@echo off
setlocal EnableDelayedExpansion

:: Check for Administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] This script requires Administrator privileges.
    echo Please right-click install-service.bat and select 'Run as administrator'.
    pause
    exit /b 1
)

set SERVICE_NAME=CampusPrintAgent
set DISPLAY_NAME=CampusPrint Windows Print Agent
set DESCRIPTION=Automated Background Spooler Bridge for Campus Print Management Platform (Canon PIXMA G2010, G3070, imageRUNNER 2224)

:: Resolve current script folder and executable path
set SCRIPT_DIR=%~dp0
set PUBLISH_DIR=%SCRIPT_DIR%..\bin\Release\net8.0-windows\publish
set EXE_PATH=%PUBLISH_DIR%\CampusPrintAgent.exe

if not exist "%EXE_PATH%" (
    set EXE_PATH=%SCRIPT_DIR%..\bin\Release\net8.0-windows\win-x64\publish\CampusPrintAgent.exe
)

if not exist "%EXE_PATH%" (
    set EXE_PATH=%SCRIPT_DIR%..\bin\Debug\net8.0-windows\CampusPrintAgent.exe
)

if not exist "%EXE_PATH%" (
    echo [ERROR] Could not find CampusPrintAgent.exe.
    echo Please build or publish the project first:
    echo   dotnet publish -c Release -r win-x64 --self-contained
    pause
    exit /b 1
)

echo [INFO] Registering Windows Service '%SERVICE_NAME%'...
echo [INFO] Binary Path: "%EXE_PATH%"

sc.exe create "%SERVICE_NAME%" binPath= "\"%EXE_PATH%\"" start= auto DisplayName= "%DISPLAY_NAME%"
sc.exe description "%SERVICE_NAME%" "%DESCRIPTION%"
sc.exe failure "%SERVICE_NAME%" reset= 86400 actions= restart/5000/restart/10000/restart/30000

echo [INFO] Starting Windows Service '%SERVICE_NAME%'...
sc.exe start "%SERVICE_NAME%"

echo.
echo ====================================================================
echo [SUCCESS] CampusPrintAgent Windows Service installed and started!
echo Check Windows Event Viewer or agent logs for active print spooling.
echo ====================================================================
pause

