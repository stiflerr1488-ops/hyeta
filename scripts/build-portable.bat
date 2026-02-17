@echo off
setlocal

cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or is not available in PATH.
  echo Install Node.js 20+ and try again.
  pause
  exit /b 1
)

echo Building fresh portable version...
node scripts\build-portable.js
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
  echo.
  echo [ERROR] Portable build failed with exit code %EXIT_CODE%.
  pause
  exit /b %EXIT_CODE%
)

echo.
echo [OK] Portable build finished successfully.
pause
