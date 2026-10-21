@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required. Install from https://nodejs.org/
  pause
  exit /b 1
)
echo Starting American Roulette multiplayer server...
echo.
echo Your computer: http://localhost:3000
echo For a link that friends can use anywhere, deploy using README.md.
echo Keep this window open while testing.
echo.
start "" "http://localhost:3000"
node server.js
if errorlevel 1 pause
