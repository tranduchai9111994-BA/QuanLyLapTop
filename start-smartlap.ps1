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
Remove-Item $PidFile -ErrorAction SilentlyContinue

function Start-Hidden($filePath, $argList, $workDir, $stdout, $stderr) {
    $p = Start-Process -FilePath $filePath -ArgumentList $argList -WorkingDirectory $workDir `
        -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    Add-Content -Path $PidFile -Value $p.Id
    return $p
}

# --- Khoi chay CA BA dich vu CUNG LUC (khong doi nhau) ---
# Truoc day script doi ML service san sang moi bat backend => cong them ~5-10s. Khong can nua vi
# backend da tu thu lai viec dong bo catalog vai lan neu ML chua kip len (xem src/server.ts).
# Goi THANG vao node/vite/tsx thay vi qua "npm run dev" de bot mot lop tien trinh trung gian.

Start-Hidden "python" @("-m", "uvicorn", "app.main:app", "--port", "8001") `
    (Join-Path $Root "ml-service") (Join-Path $Logs "ml-service.log") (Join-Path $Logs "ml-service.err.log") | Out-Null

$tsx = Join-Path $Root "backend\node_modules\tsx\dist\cli.mjs"
if (Test-Path $tsx) {
    Start-Hidden "node" @($tsx, "watch", "src/server.ts") `
        (Join-Path $Root "backend") (Join-Path $Logs "backend.log") (Join-Path $Logs "backend.err.log") | Out-Null
} else {
    Start-Hidden "npm.cmd" @("run", "dev") `
        (Join-Path $Root "backend") (Join-Path $Logs "backend.log") (Join-Path $Logs "backend.err.log") | Out-Null
}

# --strictPort: neu 5180 van bi chiem thi bao loi ro trong log thay vi am tham doi sang 5181
# (khi do trinh duyet se mo dung URL nhung sai instance).
$vite = Join-Path $Root "frontend\node_modules\vite\bin\vite.js"
if (Test-Path $vite) {
    Start-Hidden "node" @($vite, "--port", "5180", "--strictPort") `
        (Join-Path $Root "frontend") (Join-Path $Logs "frontend.log") (Join-Path $Logs "frontend.err.log") | Out-Null
} else {
    Start-Hidden "npm.cmd" @("run", "dev", "--", "--port", "5180", "--strictPort") `
        (Join-Path $Root "frontend") (Join-Path $Logs "frontend.log") (Join-Path $Logs "frontend.err.log") | Out-Null
}

# Doi frontend san sang roi mo trinh duyet. Poll moi 250ms (truoc day 1s) de mo ngay khi Vite
# len, thay vi lang phi toi gan mot giay cho vong lap.
$ready = $false
for ($i = 0; $i -lt 120; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:5180" -UseBasicParsing -TimeoutSec 1
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Start-Sleep -Milliseconds 250
}

Start-Process "http://localhost:5180"

if (-not $ready) {
    Add-Content -Path (Join-Path $Logs "start.log") -Value "$(Get-Date): frontend chua san sang sau 30s, xem logs\frontend.err.log"
}
