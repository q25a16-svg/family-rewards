# Family Rewards Control Panel - DELUXE V3.5 (English Stable Edition)
chcp 65001 > $null
$UTF8 = [System.Text.Encoding]::UTF8
$OutputEncoding = [Console]::OutputEncoding = $UTF8
$ProxyFile = Join-Path $PSScriptRoot ".proxy_config"
$EnvFile = Join-Path $PSScriptRoot "backend\.env"

# --- UI CONSTANTS (ASCII safe) ---
$B = @{
    TL = [string][char]9556 # ╔
    TR = [string][char]9559 # ╗
    BL = [string][char]9562 # ╚
    BR = [string][char]9565 # ╝
    HZ = [string][char]9552 # ═
    VT = [string][char]9553 # ║
}

function Get-State {
    $be = if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { $true } else { $false }
    $fe = if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) { $true } else { $false }
    $tn = if (Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue) { $true } else { $false }
    return @{ B=$be; F=$fe; T=$tn }
}

function Kill-Safe {
    foreach ($p in @(3000, 5173)) {
        $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
        if ($c) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue }
    }
    Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force
}

while ($true) {
    Clear-Host
    $st = Get-State
    $W = 60
    
    # Render Title Box
    Write-Host "`n   $($B.TL + ($B.HZ * ($W-2)) + $B.TR)" -ForegroundColor Cyan
    $title = "SERVICE MANAGER DELUXE v3.5.0"
    $subt  = "PROJECT CONTROL CENTER"
    
    $padT = [Math]::Max(0, [Math]::Floor(($W - 2 - $title.Length) / 2))
    $padS = [Math]::Max(0, [Math]::Floor(($W - 2 - $subt.Length) / 2))
    
    Write-Host "   $($B.VT)$(" " * $padT)$title$(" " * ($W - 2 - $title.Length - $padT))$($B.VT)" -ForegroundColor White
    Write-Host "   $($B.VT)$(" " * $padS)$subt$(" " * ($W - 2 - $subt.Length - $padS))$($B.VT)" -ForegroundColor Cyan
    Write-Host "   $($B.BL + ($B.HZ * ($W-2)) + $B.BR)" -ForegroundColor Cyan

    $mainSt = if ($st.B -and $st.T) { "SYSTEM READY" } else { "WAITING..." }
    $mainClr = if ($st.B -and $st.T) { "Green" } else { "Yellow" }
    
    Write-Host "`n   SYSTEM STATUS:  " -NoNewline -ForegroundColor White
    Write-Host $mainSt -ForegroundColor $mainClr

    Write-Host "   [ B ] Backend:  " -NoNewline -ForegroundColor Cyan; Write-Host $(if($st.B){"ONLINE"}else{"OFFLINE"}) -ForegroundColor $(if($st.B){"Green"}else{"Red"})
    Write-Host "   [ T ] Tunnel:   " -NoNewline -ForegroundColor Cyan; Write-Host $(if($st.T){"ACTIVE"}else{"INACTIVE"}) -ForegroundColor $(if($st.T){"Green"}else{"Red"})

    if ($st.T) {
        $cfg = Get-Content $EnvFile -ErrorAction SilentlyContinue | Select-String "WEBAPP_URL=(.*)"
        if ($cfg) { 
            Write-Host "`n   Current Link: " -NoNewline -ForegroundColor Gray
            Write-Host $cfg.Matches.Groups[1].Value -ForegroundColor Yellow
        }
    }

    Write-Host "`n   SYSTEM CONTROL" -ForegroundColor Yellow
    Write-Host "   [ 1 ] START SYSTEM          // Launch Backend + Tunnel" -ForegroundColor White
    Write-Host "   [ 2 ] STOP ALL              // Kill All Processes" -ForegroundColor White

    Write-Host "`n   NETWORK & PORTS" -ForegroundColor Magenta
    Write-Host "   [ 3 ] RE-CREATE TUNNEL      // Force New Cloudflare URL" -ForegroundColor White
    Write-Host "   [ 4 ] CONFIGURE PROXY       // Set HTTP Proxy" -ForegroundColor White

    Write-Host "`n   DATA & STORAGE" -ForegroundColor Cyan
    Write-Host "   [ 5 ] USER LIST             // Database Explorer" -ForegroundColor White
    Write-Host "   [ 6 ] RESET DB              // Clear All Records" -ForegroundColor White

    Write-Host "`n   [ 0 ] EXIT                  // Close Manager" -ForegroundColor White
    
    Write-Host "`n   SELECT OPTION: " -NoNewline -ForegroundColor White
    
    try {
        $k = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown").Character
    } catch {
        # Fallback if ReadKey fails in some environments
        $k = Read-Host ""
    }

    switch ($k) {
        "1" { 
             Kill-Safe; 
             Start-Process powershell -WindowStyle Hidden -ArgumentList "-Command cd backend; npm run dev"; 
             Start-Sleep -s 4
             
             # Auto-tunnel logic inline to avoid recursion complexity
             Write-Host "`n   [!] STARTING TUNNEL..." -ForegroundColor Gray
             $cmd = "npx cloudflared tunnel --url http://localhost:3000 --protocol http2"
             if (Test-Path $ProxyFile) { $p = Get-Content $ProxyFile; $env:HTTPS_PROXY=$p; $env:HTTP_PROXY=$p }
             $inf = New-Object System.Diagnostics.ProcessStartInfo; $inf.FileName = "powershell.exe"; $inf.Arguments = "-Command $cmd"
             $inf.RedirectStandardError = $true; $inf.UseShellExecute = $false; $inf.CreateNoWindow = $true
             $proc = [System.Diagnostics.Process]::Start($inf)
             
             # Non-blocking check loop or background job would be better, but simple is robust:
             # We just let it run in background. To capture URL, we need to monitor it.
             # For simplicity in this robust version, we let '3' handle the interactive url capture
             # asking user to press 3 is safer than complex logic here.
             Write-Host "   [i] Backend started. Press [3] to capture new Tunnel Link." -ForegroundColor Yellow
             Start-Sleep -s 2
        }
        "2" { Kill-Safe; Start-Sleep -s 1 }
        "3" { 
            Write-Host "`n   [!] CLEANING TUNNEL..." -ForegroundColor Gray
            Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force
            
            $cmd = "npx cloudflared tunnel --url http://localhost:3000 --protocol http2"
            if (Test-Path $ProxyFile) { $p = Get-Content $ProxyFile; $env:HTTPS_PROXY=$p; $env:HTTP_PROXY=$p }
            $inf = New-Object System.Diagnostics.ProcessStartInfo; $inf.FileName = "powershell.exe"; $inf.Arguments = "-Command $cmd"
            $inf.RedirectStandardError = $true; $inf.UseShellExecute = $false; $inf.CreateNoWindow = $true
            $proc = [System.Diagnostics.Process]::Start($inf)
            
            Write-Host "   [?] CAPTURING URL..." -ForegroundColor Yellow
            while (-not $proc.HasExited) {
                $l = $proc.StandardError.ReadLine()
                if ($l -match "https://.*\.trycloudflare\.com") {
                    $u = $Matches[0]
                    Write-Host "   [!] LINK CAPTURED: $u" -ForegroundColor Green
                    (Get-Content $EnvFile) -replace "WEBAPP_URL=.*", "WEBAPP_URL=$u" | Out-File $EnvFile -Encoding utf8
                    
                    # RESTART BACKEND TO PICK UP NEW ENV
                    Write-Host "   [R] RESTARTING BACKEND..." -ForegroundColor Yellow
                    $c = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
                    if ($c) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue }
                    Start-Process powershell -WindowStyle Hidden -ArgumentList "-Command cd backend; npm run dev"
                    
                    Write-Host "   [?] WAITING FOR PROPAGATION..." -ForegroundColor Yellow
                    for ($i=0; $i -lt 10; $i++) {
                        Write-Host "." -NoNewline -ForegroundColor Yellow
                        Start-Sleep -s 1
                    }
                    Start-Process $u
                    break
                }
            }
        }
        "4" { $r = (Read-Host "`n   Proxy (IP:PORT:USER:PASS)").Trim(); if ($r -eq "") { if (Test-Path $ProxyFile) { Remove-Item $ProxyFile } } else { $r | Out-File $ProxyFile -Encoding ascii } }
        "5" { cd backend; npm run cli users list; cd ..; Pause }
        "6" { cd backend; npx prisma migrate reset --force; npm run seed; cd ..; Pause }
        "0" { exit }
    }
}
