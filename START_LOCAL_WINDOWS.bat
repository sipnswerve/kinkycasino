@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required. Install from https://nodejs.org/
  pause
  exit /b 1
)
rem Use a distinct port so an OLD Rory's Kinky Casino on :3000 cannot be mistaken for V5.
set "PORT=3037"
echo Starting Rory's Kinky Casino Reference Wheel V5...
echo.
echo Correct roulette groups: A/B/C = columns; 1/2/3 = dozens; 0 and 00 = blank.
echo This build opens on http://localhost:%PORT% rather than the older :3000.
echo Keep the server window open while you play.
echo.
start "Rory's Kinky Casino V5 Server" cmd /k "set PORT=3037&&node server.js"
powershell -NoProfile -Command "$ready=$false; for($i=0;$i -lt 50;$i++){try{$r=Invoke-RestMethod -Uri 'http://127.0.0.1:3037/health' -TimeoutSec 1;if($r.version -eq '5.0.0' -and $r.table -eq 'single-shared-v5'){$ready=$true;break}}catch{};Start-Sleep -Milliseconds 250};if(-not $ready){exit 1}"
if errorlevel 1 (
  echo.
  echo Could not verify the NEW game server. Close other Rory's Kinky Casino server windows and retry.
  echo If port 3037 is in use, stop that process before trying again.
  pause
  exit /b 1
)
start "" "http://localhost:%PORT%/?game=kinky-casino-v5"
echo Opened Rory's Kinky Casino Reference Wheel V5 at http://localhost:%PORT%
exit /b 0
