@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or is not available in PATH.
  echo Install Node.js 20+ and try again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo node_modules not found. Running npm install once...
  npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed with exit code %ERRORLEVEL%.
    pause
    exit /b %ERRORLEVEL%
  )
)

echo Starting app without packaging (development mode)...
npm start
set EXIT_CODE=%ERRORLEVEL%

echo.
if "%EXIT_CODE%"=="0" (
  echo [OK] App closed normally.
) else (
  echo [ERROR] App exited with code %EXIT_CODE%.
)

pause
exit /b %EXIT_CODE%
