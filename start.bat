@echo off
setlocal

pushd "%~dp0"
if errorlevel 1 (
  echo Failed to open the project folder.
  pause
  exit /b 1
)

rem Check Node.js
node --version >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found.
  echo Please install Node.js, then run this file again.
  pause
  exit /b 1
)

rem Install dependencies if needed
if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Starting Tomari dev server...
echo Close the server window to stop the app.

start "Tomari dev server" /D "%~dp0" cmd /k "npx vite --host 127.0.0.1 --open /%E3%83%88%E3%83%9E%E3%83%AA%E3%83%88%E3%83%BC%E3%82%AF.html"

popd
endlocal
