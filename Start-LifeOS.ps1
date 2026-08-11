param(
    [switch]$NoBrowser,
    [switch]$Server,
    [string]$Page = "content"
)

$ErrorActionPreference = "Stop"

$baseUrl = "http://127.0.0.1:3000"
$platformDir = $PSScriptRoot
$openUrl = "$baseUrl/$Page"
$healthUrl = "$baseUrl/api/ai/conversations"
$runtimeUrl = "$baseUrl/api/system/runtime"

function Exit-WithMessage {
    param(
        [string]$Message,
        [int]$Code = 1
    )

    Write-Host $Message

    if (-not $NoBrowser) {
        pause
    }

    exit $Code
}

function Find-Pnpm {
    $appDataPnpm = Join-Path $env:APPDATA "npm\pnpm.cmd"

    if (Test-Path $appDataPnpm) {
        return $appDataPnpm
    }

    $command = Get-Command "pnpm.cmd" -ErrorAction SilentlyContinue

    if ($command) {
        return $command.Source
    }

    return $null
}

function Escape-SingleQuotedPowerShellString {
    param([string]$Value)

    return $Value.Replace("'", "''")
}

function Test-LifeOSResponding {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $baseUrl -TimeoutSec 2
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Get-Port3000ProcessIds {
    $ids = @()

    foreach ($line in (& netstat -ano)) {
        if ($line -match '^\s*TCP\s+\S+:3000\s+\S+\s+LISTENING\s+(\d+)\s*$') {
            $ids += [int]$Matches[1]
        }
    }

    return $ids | Sort-Object -Unique
}

function Test-LifeOSHealthy {
    try {
        $runtimeResponse = Invoke-WebRequest -UseBasicParsing -Uri $runtimeUrl -TimeoutSec 3
        $runtimeInfo = $runtimeResponse.Content | ConvertFrom-Json

        if ($runtimeResponse.StatusCode -ne 200 -or $runtimeInfo.ok -ne $true) {
            return $false
        }

        if (@("development", "production") -notcontains [string]$runtimeInfo.nodeEnv) {
            return $false
        }

        $response = Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 3
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Restore-NextEnvForDev {
    $nextEnvPath = Join-Path $platformDir "apps\web\next-env.d.ts"

    if (-not (Test-Path $nextEnvPath)) {
        return
    }

    $content = [System.IO.File]::ReadAllText($nextEnvPath)
    $content = $content.Replace("./.next-build-runtime-v2/types/routes.d.ts", "./.next-dev/dev/types/routes.d.ts")
    [System.IO.File]::WriteAllText($nextEnvPath, $content)
}

function Restore-NextEnvForBuild {
    $nextEnvPath = Join-Path $platformDir "apps\web\next-env.d.ts"

    if (-not (Test-Path $nextEnvPath)) {
        return
    }

    $content = [System.IO.File]::ReadAllText($nextEnvPath)
    $content = $content.Replace("./.next-dev/dev/types/routes.d.ts", "./.next-build-runtime-v2/types/routes.d.ts")
    [System.IO.File]::WriteAllText($nextEnvPath, $content)
}

function Get-LatestSourceWriteTime {
    $webDir = Join-Path $platformDir "apps\web"
    $sourcePaths = @(
        "app",
        "components",
        "lib",
        "public",
        "package.json",
        "next.config.ts",
        "tsconfig.json"
    )
    $latest = [DateTime]::MinValue

    foreach ($relativePath in $sourcePaths) {
        $path = Join-Path $webDir $relativePath

        if (-not (Test-Path $path)) {
            continue
        }

        $item = Get-Item -LiteralPath $path

        if ($item.PSIsContainer) {
            $files = @(Get-ChildItem -LiteralPath $path -Recurse -File -ErrorAction SilentlyContinue)

            foreach ($file in $files) {
                if ($file.LastWriteTimeUtc -gt $latest) {
                    $latest = $file.LastWriteTimeUtc
                }
            }
        } elseif ($item.LastWriteTimeUtc -gt $latest) {
            $latest = $item.LastWriteTimeUtc
        }
    }

    return $latest
}

function Test-LifeOSBuildFresh {
    $buildIdPath = Join-Path $platformDir "apps\web\.next-build-runtime-v2\BUILD_ID"

    if (-not (Test-Path $buildIdPath)) {
        return $false
    }

    $buildTime = (Get-Item -LiteralPath $buildIdPath).LastWriteTimeUtc
    $latestSourceTime = Get-LatestSourceWriteTime

    return $latestSourceTime -le $buildTime
}

function Ensure-LifeOSBuild {
    if (Test-LifeOSBuildFresh) {
        return
    }

    $pnpm = Find-Pnpm

    if (-not $pnpm) {
        Exit-WithMessage "Cannot find pnpm. Please install pnpm first."
    }

    $nodePath = "C:\Program Files\nodejs"
    $npmBinPath = Join-Path $env:APPDATA "npm"
    $env:Path = "$nodePath;$npmBinPath;$env:Path"

    Restore-NextEnvForBuild

    Write-Host "Building Life OS for quiet background startup..."
    & $pnpm --filter "@life-os/web" build

    if ($LASTEXITCODE -ne 0) {
        Exit-WithMessage "Life OS build failed. Please check the build output above."
    }
}

function Start-LifeOSDevServer {
    $pnpm = Find-Pnpm

    if (-not $pnpm) {
        Exit-WithMessage "Cannot find pnpm. Please install pnpm first."
    }

    $nodePath = "C:\Program Files\nodejs"
    $npmBinPath = Join-Path $env:APPDATA "npm"
    $env:Path = "$nodePath;$npmBinPath;$env:Path"

    Restore-NextEnvForDev

    Write-Host "Starting Life OS dev server at $baseUrl ..."
    Write-Host "Private data stays in apps/web/data. Do not close this window while using Life OS."
    & $pnpm --filter "@life-os/web" dev
}

function Start-LifeOSServerWindow {
    $pnpm = Find-Pnpm

    if (-not $pnpm) {
        Exit-WithMessage "Cannot find pnpm. Please install pnpm first."
    }

    Ensure-LifeOSBuild

    $logPath = Join-Path $platformDir "apps\web\life-os-server.log"
    $errorLogPath = Join-Path $platformDir "apps\web\life-os-server-error.log"
    $nodePath = "C:\Program Files\nodejs"
    $npmBinPath = Join-Path $env:APPDATA "npm"
    $env:Path = "$nodePath;$npmBinPath;$env:Path"

    [System.IO.File]::WriteAllText($logPath, "Starting Life OS dev server at $baseUrl ...`r`nPrivate data stays in apps/web/data.`r`n")
    [System.IO.File]::WriteAllText($errorLogPath, "")

    Start-Process -FilePath $pnpm `
        -ArgumentList @("--filter", "@life-os/web", "start", "-H", "127.0.0.1", "-p", "3000") `
        -RedirectStandardOutput $logPath `
        -RedirectStandardError $errorLogPath `
        -WindowStyle Hidden `
        -WorkingDirectory $platformDir
}

if ($Server) {
    Start-LifeOSDevServer
    exit $LASTEXITCODE
}

if (Test-LifeOSResponding) {
    if (-not (Test-LifeOSHealthy)) {
        Write-Host ""
        Write-Host "Life OS cannot start because port 3000 is already occupied by an old server."
        Write-Host ""
        $portProcessIds = @(Get-Port3000ProcessIds)

        if ($portProcessIds.Count) {
            Write-Host "Process using port 3000: $($portProcessIds -join ', ')"
        }

        Write-Host "Closing the browser tab is not enough; the background Node/PowerShell server may still be running."
        Write-Host ""
        if (-not $NoBrowser -and $portProcessIds.Count) {
            $answer = Read-Host "Type Y to stop the old server and restart Life OS, or press Enter to exit"

            if ($answer -match '^(y|Y)$') {
                foreach ($processId in $portProcessIds) {
                    try {
                        Stop-Process -Id $processId -Force
                        Write-Host "Stopped process $processId."
                    } catch {
                        Write-Host "Could not stop process $processId. Please close it manually."
                    }
                }

                Start-Sleep -Seconds 2
                Start-LifeOSServerWindow

                for ($i = 0; $i -lt 90; $i++) {
                    if (Test-LifeOSHealthy) {
                        break
                    }

                    Start-Sleep -Seconds 1
                }
            } else {
                exit 1
            }
        } else {
            Write-Host "Please close the old Life OS PowerShell window or stop the process above, then run this starter again."
            Write-Host "This prevents Next.js static chunk mismatch."
            exit 1
        }
        Write-Host ""
    }
} else {
    Start-LifeOSServerWindow

    for ($i = 0; $i -lt 90; $i++) {
        if (Test-LifeOSHealthy) {
            break
        }

        Start-Sleep -Seconds 1
    }
}

if (-not (Test-LifeOSHealthy)) {
    Exit-WithMessage "Life OS did not become ready in time. Check the server window for details."
}

if (-not $NoBrowser) {
    Start-Process $openUrl
}
