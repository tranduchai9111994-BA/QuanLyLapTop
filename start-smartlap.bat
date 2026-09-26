@echo off
setlocal
set ROOT=%~dp0

echo Dang khoi dong SmartLap...

start "SmartLap - ML service (8001)" cmd /k "cd /d %ROOT%ml-service && python -m uvicorn app.main:app --port 8001"
timeout /t 3 /nobreak >nul

start "SmartLap - Backend (4000)" cmd /k "cd /d %ROOT%backend && npm run dev"
timeout /t 3 /nobreak >nul

start "SmartLap - Frontend (5180)" cmd /k "cd /d %ROOT%frontend && npm run dev -- --port 5180"
timeout /t 5 /nobreak >nul

start "" "http://localhost:5180"

endlocal
