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
node -e "const [M,m]=process.versions.node.split('.').map(Number);process.exit((M===20&&m>=19)||(M===22&&m>=12)||M>22?0:1)" >nul 2>nul
if errorlevel 1 (
  echo Node.js 20.19+ or 22.12+ is required by Vite 8.
  echo Please update Node.js, then run this file again.
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

start "Tomari dev server" /D "%~dp0" cmd /k "npx vite"

popd
endlocal
