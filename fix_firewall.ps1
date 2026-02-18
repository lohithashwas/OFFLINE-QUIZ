New-NetFirewallRule -DisplayName "Offline Quiz Allow" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
Write-Host "Firewall rule added for Port 3000!" -ForegroundColor Green
Read-Host -Prompt "Press Enter to exit"
