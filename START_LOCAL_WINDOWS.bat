@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required. Install from https://nodejs.org/
  pause
  exit /b 1
)
rem Use a distinct port so an OLD Rory's Roulette on :3000 cannot be mistaken for V4.
set "PORT=3036"
echo Starting Rory's Roulette Reference Wheel V4...
echo.
echo Correct roulette groups: A/B/C = columns; 1/2/3 = dozens; 0 and 00 = blank.
echo This build opens on http://localhost:%PORT% rather than the older :3000.
echo Keep the server window open while you play.
echo.
start "Rory's Roulette V4 Server" cmd /k "set PORT=3036&&node server.js"
powershell -NoProfile -Command "$ready=$false; for($i=0;$i -lt 50;$i++){try{$r=Invoke-RestMethod -Uri 'http://127.0.0.1:3036/health' -TimeoutSec 1;if($r.version -eq '4.0.0' -and $r.wheel -eq 'correct-dozens-columns-v4-20261022'){$ready=$true;break}}catch{};Start-Sleep -Milliseconds 250};if(-not $ready){exit 1}"
if errorlevel 1 (
  echo.
  echo Could not verify the NEW game server. Close other Rory's Roulette server windows and retry.
  echo If port 3036 is in use, stop that process before trying again.
  pause
  exit /b 1
)
start "" "http://localhost:%PORT%/?wheel=dozens-columns-v4"
echo Opened Rory's Roulette Reference Wheel V4 at http://localhost:%PORT%
exit /b 0
