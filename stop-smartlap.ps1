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
    Where-Object { $_.CommandLine -match "uvicorn app\.main|tsx.{0,20}src.server\.ts|vite" } |
    ForEach-Object { taskkill /PID $_.ProcessId /T /F 2>$null | Out-Null }

# Lop bao ve cuoi: giai phong dung 3 cong muc tieu bang bat ky tien trinh nao dang giu no,
# de lan khoi chay tiep theo khong bao gio bi doi sang cong khac (nguyen nhan icon "cham mai
# khong len" da gap truoc do).
foreach ($port in 4000, 8001, 5180) {
    Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        ForEach-Object { taskkill /PID $_ /T /F 2>$null | Out-Null }
}
