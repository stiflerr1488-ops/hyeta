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
  echo node_modules not found. Running npm install first...
) else (
  echo node_modules found. Running npm install check/update...
)

npm install
if errorlevel 1 (
  echo.
  echo [ERROR] npm install failed with exit code %ERRORLEVEL%.
  pause
  exit /b %ERRORLEVEL%
)

echo.
echo Building fresh portable version...
node scripts\build-portable.js
if errorlevel 1 (
  echo.
  echo [ERROR] Portable build failed with exit code %ERRORLEVEL%.
  pause
  exit /b %ERRORLEVEL%
)

echo.
echo [OK] Portable build finished successfully.
echo Portable .exe is now in the project root folder.
pause
