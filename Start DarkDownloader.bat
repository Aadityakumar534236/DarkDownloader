@echo off
setlocal
pushd "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo DarkDownloader's virtual environment was not found.
  echo Run the setup commands in README.md first.
  pause
  exit /b 1
)

".venv\Scripts\python.exe" -c "import socket,sys; s=socket.socket(); s.settimeout(0.5); result=s.connect_ex(('127.0.0.1',5000)); s.close(); sys.exit(0 if result == 0 else 1)"
if not errorlevel 1 (
  echo DarkDownloader is already running at http://127.0.0.1:5000
  start "" "http://127.0.0.1:5000"
  popd
  exit /b 0
)

start "DarkDownloader Server" ".venv\Scripts\python.exe" "run.py"
echo Starting DarkDownloader...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ready=$false; for($i=0; $i -lt 30; $i++){ try { $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://127.0.0.1:5000/api/v1/health; if($r.StatusCode -eq 200){$ready=$true;break} } catch {}; Start-Sleep -Milliseconds 500 }; if($ready){Start-Process 'http://127.0.0.1:5000'} else {Write-Host 'The server did not respond. Check the DarkDownloader Server window for errors.'; Read-Host 'Press Enter to close'}"
popd
endlocal
