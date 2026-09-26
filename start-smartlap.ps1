# Khoi chay SmartLap (ML service + Backend + Frontend) an, khong hien cua so terminal.
# Goi tu start-smartlap.vbs (chay hoan toan im lang) hoac chay truc tiep bang powershell.

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Logs = Join-Path $Root "logs"
New-Item -ItemType Directory -Force -Path $Logs | Out-Null
$PidFile = Join-Path $Logs "pids.txt"
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

Start-Hidden "npm.cmd" @("run", "dev", "--", "--port", "5180") `
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

Start-Process "http://localhost:5180"

if (-not $ready) {
    # Frontend chua san sang sau 30s - ghi chu de nguoi dung biet xem log
    Add-Content -Path (Join-Path $Logs "start.log") -Value "$(Get-Date): frontend chua san sang sau 30s, xem cac file .log de biet loi"
}
