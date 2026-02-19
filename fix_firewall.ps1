# Remove old rule if it exists (to avoid duplicates)
Remove-NetFirewallRule -DisplayName "Offline Quiz Allow" -ErrorAction SilentlyContinue

# Add rule for ALL profiles (Private, Public, Domain)
New-NetFirewallRule -DisplayName "Offline Quiz Allow" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Any

Write-Host ""
Write-Host "Firewall rule added for Port 3000 on ALL network profiles!" -ForegroundColor Green
Write-Host ""
Write-Host "Now run 'node server.js' and check the IP printed in the console." -ForegroundColor Yellow
Write-Host "Make sure participants use THAT IP (it changes with each hotspot)." -ForegroundColor Yellow
Write-Host ""
Read-Host -Prompt "Press Enter to exit"
