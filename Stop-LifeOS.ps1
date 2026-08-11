param(
    [switch]$Silent
)

$ErrorActionPreference = "Stop"

function Get-Port3000ProcessIds {
    $ids = @()

    foreach ($line in (& netstat -ano)) {
        if ($line -match '^\s*TCP\s+\S+:3000\s+\S+\s+LISTENING\s+(\d+)\s*$') {
            $ids += [int]$Matches[1]
        }
    }

    return $ids | Sort-Object -Unique
}

$processIds = @(Get-Port3000ProcessIds)

if (-not $processIds.Count) {
    if (-not $Silent) {
        Write-Host "Life OS is not running on port 3000."
        pause
    }

    exit 0
}

foreach ($processId in $processIds) {
    try {
        Stop-Process -Id $processId -Force

        if (-not $Silent) {
            Write-Host "Stopped Life OS process $processId."
        }
    } catch {
        if (-not $Silent) {
            Write-Host "Could not stop process $processId. Please close it manually."
        }
    }
}

if (-not $Silent) {
    pause
}
