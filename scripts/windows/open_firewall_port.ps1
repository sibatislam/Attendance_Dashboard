# PowerShell script to open Windows Firewall port 8081 for FastAPI backend
# Run this script as Administrator

Write-Host "Opening Windows Firewall port 8081 for FastAPI backend..." -ForegroundColor Yellow

try {
    # Check if rule already exists
    $existingRule = Get-NetFirewallRule -DisplayName "FastAPI Backend Port 8081" -ErrorAction SilentlyContinue
    
    if ($existingRule) {
        Write-Host "[INFO] Firewall rule already exists. Removing old rule..." -ForegroundColor Cyan
        Remove-NetFirewallRule -DisplayName "FastAPI Backend Port 8081" -ErrorAction SilentlyContinue
    }
    
    # Create new firewall rule
    New-NetFirewallRule -DisplayName "FastAPI Backend Port 8081" `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort 8081 `
        -Action Allow `
        -Profile Domain,Private,Public `
        -Description "Allow FastAPI backend on port 8081 for network access"
    
    Write-Host "[SUCCESS] Port 8081 has been opened in Windows Firewall!" -ForegroundColor Green
    Write-Host "You can now access the backend from other PCs on the network." -ForegroundColor Green
    
    # Verify the rule
    Write-Host "`nVerifying firewall rule..." -ForegroundColor Cyan
    Get-NetFirewallRule -DisplayName "FastAPI Backend Port 8081" | Format-Table DisplayName, Enabled, Direction, Action
    
} catch {
    Write-Host "[ERROR] Failed to create firewall rule: $_" -ForegroundColor Red
    Write-Host "Please make sure you are running this script as Administrator." -ForegroundColor Yellow
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

Write-Host "`nPress any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
