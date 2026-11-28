# Bật lại BE + Cloudflare tunnel sau khi tắt máy.
# Chạy:  powershell -ExecutionPolicy Bypass -File .\scripts\start-tunnel-demo.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Datn = Join-Path $Root "DATN"
$Netlify = "https://glittery-kataifi-a6f6ad.netlify.app"
$JavaHome = "C:\Program Files\Java\jdk-25.0.4.1"
$Cloudflared = Join-Path $env:TEMP "cloudflared.exe"
if (-not $env:SPRING_DATASOURCE_PASSWORD) {
    $env:SPRING_DATASOURCE_PASSWORD = "Minh2212345"
}

function Wait-Port([int]$Port, [int]$Seconds = 120) {
    $until = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $until) {
        $ok = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($ok) { return }
        Start-Sleep -Seconds 2
    }
    throw "Het thoi gian cho cong $Port"
}

Write-Host "1) SQL Server phai dang chay (Services: SQL Server)." -ForegroundColor Yellow

$env:JAVA_HOME = $JavaHome
$env:PATH = "$JavaHome\bin;" + $env:PATH

$listening = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
    Write-Host "2) Start Spring Boot 8080..."
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c mvnw.cmd spring-boot:run" -WorkingDirectory $Datn -WindowStyle Normal
    Wait-Port 8080 180
} else {
    Write-Host "2) BE da chay tren 8080."
}

if (-not (Test-Path $Cloudflared)) {
    Write-Host "3) Tai cloudflared..."
    Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $Cloudflared -UseBasicParsing
}

Write-Host "3) Mo tunnel Cloudflare (de cua so nay mo)..."
$p = Start-Process -FilePath $Cloudflared -ArgumentList "tunnel --url http://localhost:8080" -NoNewWindow -PassThru -RedirectStandardError (Join-Path $env:TEMP "cloudflared-demo.err.log") -RedirectStandardOutput (Join-Path $env:TEMP "cloudflared-demo.out.log")

$url = $null
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 1
    $log = ""
    foreach ($f in @((Join-Path $env:TEMP "cloudflared-demo.err.log"), (Join-Path $env:TEMP "cloudflared-demo.out.log"))) {
        if (Test-Path $f) { $log += Get-Content $f -Raw -ErrorAction SilentlyContinue }
    }
    if ($log -match "https://[a-z0-9-]+\.trycloudflare\.com") {
        $url = $Matches[0]
        break
    }
    if ($p.HasExited) { throw "cloudflared da thoat. Xem log %TEMP%\cloudflared-demo.err.log" }
}

if (-not $url) { throw "Khong lay duoc URL tunnel." }

$demo = "$Netlify/?api=$url"
Write-Host ""
Write-Host "BE tunnel: $url" -ForegroundColor Green
Write-Host "Mo 1 lan (gan API vao Netlify):" -ForegroundColor Green
Write-Host $demo
Write-Host ""
Write-Host "Giu cua so Spring Boot + tunnel. Ctrl+C o day khong tat BE."
Start-Process $demo
Wait-Process -Id $p.Id
