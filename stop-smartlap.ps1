# Dung toan bo SmartLap (ML service + Backend + Frontend) da khoi chay boi start-smartlap.ps1

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$PidFile = Join-Path $Root "logs\pids.txt"

if (Test-Path $PidFile) {
    Get-Content $PidFile | ForEach-Object {
        $procId = $_.Trim()
        if ($procId -match '^\d+$') {
            # /T de diet luon tien trinh con (vd npm.cmd -> node thuc thi vite/tsx)
            & taskkill /PID $procId /T /F 2>$null | Out-Null
        }
    }
    Remove-Item $PidFile -ErrorAction SilentlyContinue
}

# Don du phong: diet theo dong lenh neu con sot (vd nguoi dung khoi chay thu cong truoc do)
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match "uvicorn app\.main|tsx.{0,20}src.server\.ts|vite.*5180" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
