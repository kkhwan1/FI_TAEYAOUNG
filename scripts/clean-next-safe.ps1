# Safe .next folder deletion script (Windows file lock issue fix)
# Checks file lock status and safely deletes on Windows

# Fix encoding for proper character display
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$PORT = 5000
$MAX_RETRIES = 5
$RETRY_DELAY = 2 # seconds

function Test-FileLock {
    param(
        [string]$Path
    )
    
    $fileLocked = $false
    $fileInfo = New-Object System.IO.FileInfo($Path)
    
    try {
        $stream = $fileInfo.Open([System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
        if ($stream) {
            $stream.Close()
        }
    } catch {
        $fileLocked = $true
    }
    
    return $fileLocked
}

function Remove-NextFolderSafe {
    param(
        [string]$FolderPath = ".next"
    )
    
    if (-not (Test-Path $FolderPath)) {
        Write-Host "[INFO] Folder '$FolderPath' does not exist."
        return $true
    }
    
    Write-Host "[INFO] Safely deleting '$FolderPath' folder..."
    
    # 1. Check and stop server running on port
    $conn = netstat -ano | findstr ":$PORT"
    if ($conn) {
        $pid = ($conn -split '\s+')[-1]
        Write-Host "[WARNING] Process found on port $PORT (PID: $pid)"
        Write-Host "[ACTION] Stopping process..."
        taskkill /F /PID $pid 2>$null
        Start-Sleep -Seconds 3
    }
    
    # 2. Stop Node.js processes
    $nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
    if ($nodeProcesses) {
        Write-Host "[INFO] Stopping running Node.js processes..."
        $nodeProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
    
    # 3. Wait for file system stabilization
    Write-Host "[INFO] Waiting for file system to stabilize..."
    Start-Sleep -Seconds 2
    
    # 4. Multiple attempts to delete folder
    $retryCount = 0
    $success = $false
    
    while ($retryCount -lt $MAX_RETRIES -and -not $success) {
        $retryCount++
        Write-Host "[ATTEMPT $retryCount/$MAX_RETRIES] Attempting to delete folder..."
        
        try {
            # Remove file attributes (remove read-only files)
            Get-ChildItem -Path $FolderPath -Recurse -Force -ErrorAction SilentlyContinue | 
                ForEach-Object { 
                    $_.Attributes = 'Normal' 
                }
            
            # Attempt folder deletion
            Remove-Item -Path $FolderPath -Recurse -Force -ErrorAction Stop
            
            # Verify deletion
            Start-Sleep -Seconds 1
            if (-not (Test-Path $FolderPath)) {
                $success = $true
                Write-Host "[SUCCESS] Folder '$FolderPath' successfully deleted."
            } else {
                Write-Host "[WARNING] Folder still exists. Retrying..."
            }
        } catch {
            Write-Host "[WARNING] Deletion failed: $($_.Exception.Message)"
            
            if ($retryCount -lt $MAX_RETRIES) {
                Write-Host "[INFO] Retrying in ${RETRY_DELAY} seconds..."
                Start-Sleep -Seconds $RETRY_DELAY
                
                # Recheck Node.js processes before retry
                $nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
                if ($nodeProcesses) {
                    Write-Host "[INFO] Stopping remaining Node.js processes..."
                    $nodeProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
                    Start-Sleep -Seconds 2
                }
            }
        }
    }
    
    if (-not $success) {
        Write-Host "[ERROR] Failed to delete folder after $MAX_RETRIES attempts."
        Write-Host "[INFO] Please delete the folder manually or restart your computer."
        return $false
    }
    
    return $true
}

# Main execution
Write-Host ""
Write-Host "=========================================="
Write-Host "  Safe .next Folder Deletion Script"
Write-Host "  Windows File Lock Issue Fix"
Write-Host "=========================================="
Write-Host ""

$result = Remove-NextFolderSafe

Write-Host ""
if ($result) {
    Write-Host "[SUCCESS] Operation completed successfully."
    exit 0
} else {
    Write-Host "[ERROR] Operation failed."
    exit 1
}
