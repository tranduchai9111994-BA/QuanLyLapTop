# Khoi chay SmartLap (ML service + Backend + Frontend) an, khong hien cua so terminal.
# Goi tu start-smartlap.vbs (chay hoan toan im lang) hoac chay truc tiep bang powershell.

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Logs = Join-Path $Root "logs"
New-Item -ItemType Directory -Force -Path $Logs | Out-Null
$PidFile = Join-Path $Logs "pids.txt"

# Luon don sach tien trinh cu (neu co) truoc khi khoi chay moi. Thieu buoc nay la nguyen nhan
# hay gap nhat khien icon "chay mai khong len": port 4000/8001/5180 bi tien trinh cu tu lan
# truoc chiem giu, Vite/uvicorn phai doi sang port khac ma trinh duyet van mo port cu (chet).
& (Join-Path $Root "stop-smartlap.ps1")
Start-Sleep -Seconds 1
Remove-Item $PidFile -ErrorAction SilentlyContinue

function Start-Hidden($filePath, $argList, $workDir, $stdout, $stderr) {
    $p = Start-Process -FilePath $filePath -ArgumentList $argList -WorkingDirectory $workDir `
        -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    Add-Content -Path $PidFile -Value $p.Id
    return $p
}

Start-Hidden "python" @("-m", "uvicorn", "app.main:app", "--port", "8001") `
    (Join-Path $Root "ml-service") (Join-Path $Logs "ml-service.log") (Join-Path $Logs "ml-service.err.log") | Out-Null

# Doi ML service san sang truoc khi bat backend, de lan dong bo catalog dau tien thanh cong ngay
# (backend van tu retry neu khong kip, nhung cho o day giup nhanh va it nhieu log canh bao hon).
for ($i = 0; $i -lt 20; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:8001/health" -UseBasicParsing -TimeoutSec 2
        if ($r.StatusCode -eq 200) { break }
    } catch {}
    Start-Sleep -Milliseconds 500
}

Start-Hidden "npm.cmd" @("run", "dev") `
    (Join-Path $Root "backend") (Join-Path $Logs "backend.log") (Join-Path $Logs "backend.err.log") | Out-Null

# --strictPort: neu 5180 van bi chiem (vd tien trinh la), Vite bao loi ro rang trong log thay vi
# am tham doi sang 5181 - tranh tinh trang trinh duyet mo dung URL nhung sai instance.
Start-Hidden "npm.cmd" @("run", "dev", "--", "--port", "5180", "--strictPort") `
    (Join-Path $Root "frontend") (Join-Path $Logs "frontend.log") (Join-Path $Logs "frontend.err.log") | Out-Null

# Cho frontend san sang roi moi mo trinh duyet (toi da ~30s)
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:5180" -UseBasicParsing -TimeoutSec 2
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
}

if ($ready) {
    Start-Process "http://localhost:5180"
} else {
    # Frontend khong len duoc sau 30s (vd loi that su, khong phai xung dot port) - ghi chu va
    # van mo trinh duyet de nguoi dung thay thong bao loi thay vi tuong nhu "khong co gi xay ra".
    Add-Content -Path (Join-Path $Logs "start.log") -Value "$(Get-Date): frontend chua san sang sau 30s, xem logs\frontend.err.log"
    Start-Process "http://localhost:5180"
}
