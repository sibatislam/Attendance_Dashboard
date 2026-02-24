# How to Open Port 8081 in Windows Firewall

## Quick Fix (Choose ONE method):

### Method 1: Run the Batch File as Administrator (Easiest)
1. Navigate to: `scripts\windows\open_firewall_port.bat`
2. **Right-click** the file
3. Select **"Run as administrator"**
4. Click "Yes" when prompted
5. Wait for the success message

### Method 2: Run the PowerShell Script as Administrator
1. Navigate to: `scripts\windows\open_firewall_port.ps1`
2. **Right-click** the file
3. Select **"Run with PowerShell"** (as Administrator)
4. If you get an execution policy error, run this first:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

### Method 3: Manual GUI Method
1. Press `Win + R`
2. Type `wf.msc` and press Enter
3. Click **"Inbound Rules"** → **"New Rule..."**
4. Select **"Port"** → Next
5. Select **"TCP"** and enter `8081` in "Specific local ports" → Next
6. Select **"Allow the connection"** → Next
7. Check all profiles (Domain, Private, Public) → Next
8. Name it **"FastAPI Backend Port 8081"** → Finish

### Method 4: PowerShell Command (Run as Administrator)
1. Right-click **PowerShell** → **"Run as Administrator"**
2. Run:
   ```powershell
   New-NetFirewallRule -DisplayName "FastAPI Backend Port 8081" -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow -Profile Domain,Private,Public
   ```

## Verify It Worked:
From another PC/laptop, test:
```powershell
Test-NetConnection 172.16.85.189 -Port 8081
```
Should show: `TcpTestSucceeded : True`

## After Opening the Port:
- Restart the backend if needed
- Colleagues can login at: http://172.16.85.189:5174/login
