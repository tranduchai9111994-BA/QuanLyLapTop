@echo off
echo Dang dung SmartLap (ML service, backend, frontend)...
taskkill /FI "WINDOWTITLE eq SmartLap - ML service*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq SmartLap - Backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq SmartLap - Frontend*" /T /F >nul 2>&1
echo Da dung xong.
pause
