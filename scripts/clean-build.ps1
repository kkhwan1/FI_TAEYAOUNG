# Safe build cache deletion script (Windows file lock issue fix)
# Fix encoding for proper character display
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$PORT = 5000
$MAX_RETRIES = 5
$RETRY_DELAY = 2 # seconds

Write-Host "Safely deleting build cache..."
Write-Host ""

# 1. Check and stop server if running
$conn = netstat -ano | findstr ":$PORT"
if ($conn) {
    $pid = ($conn -split '\s+')[-1]
    Write-Host "[WARNING] Server is running (PID: $pid)"
    $response = Read-Host "Stop server and continue? (y/n)"
    
    if ($response -eq 'y' -or $response -eq 'Y') {
        Write-Host "[INFO] Stopping server..."
        taskkill /F /PID $pid 2>$null
        Start-Sleep -Seconds 3
        
        # Check and stop Node.js processes
        $nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
        if ($nodeProcesses) {
            Write-Host "[INFO] Stopping remaining Node.js processes..."
            $nodeProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        }
    } else {
        Write-Host "Operation cancelled."
        exit 0
    }
} else {
    # Check Node.js processes even if server is not running
    $nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
    if ($nodeProcesses) {
        Write-Host "[WARNING] Running Node.js processes detected."
        Write-Host "[INFO] Stopping to prevent file locks..."
        $nodeProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
}

# 2. Wait for file system stabilization
Write-Host "[INFO] Waiting for file system to stabilize..."
Start-Sleep -Seconds 2

# 3. Safe .next folder deletion (with retry logic)
if (Test-Path ".next") {
    Write-Host "[INFO] Safely deleting .next folder..."
    
    $retryCount = 0
    $success = $false
    
    while ($retryCount -lt $MAX_RETRIES -and -not $success) {
        $retryCount++
        Write-Host "[ATTEMPT $retryCount/$MAX_RETRIES] Attempting to delete .next folder..."
        
        try {
            # Remove read-only file attributes
            Get-ChildItem -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue | 
                ForEach-Object { 
                    try {
                        $_.Attributes = 'Normal'
                    } catch {
                        # Ignore attribute change failures
                    }
                }
            
            # Attempt folder deletion
            Remove-Item -Path ".next" -Recurse -Force -ErrorAction Stop
            
            # Verify deletion
            Start-Sleep -Seconds 1
            if (-not (Test-Path ".next")) {
                $success = $true
                Write-Host "[SUCCESS] .next folder successfully deleted."
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
        Write-Host "[ERROR] Failed to delete .next folder after $MAX_RETRIES attempts."
        Write-Host "[INFO] Please use clean-next-safe.ps1 script or restart your computer."
    }
} else {
    Write-Host "[INFO] .next folder does not exist."
}

# 4. Delete node_modules/.cache (optional)
if (Test-Path "node_modules/.cache") {
    Write-Host "[INFO] Deleting node_modules/.cache folder..."
    try {
        Remove-Item -Recurse -Force "node_modules/.cache" -ErrorAction Stop
        Write-Host "[SUCCESS] Cache deleted."
    } catch {
        Write-Host "[WARNING] Cache deletion failed: $($_.Exception.Message)"
    }
}

Write-Host ""
Write-Host "[SUCCESS] Build cache cleanup completed."
Write-Host "Run 'npm run dev:safe' to start the server."
