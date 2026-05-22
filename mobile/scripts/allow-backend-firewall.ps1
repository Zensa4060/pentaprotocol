# Run PowerShell as Administrator. Allows phones on your LAN to reach uvicorn on port 8000.
$ruleName = "PentaProtocol Backend 8000"
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "Rule already exists: $ruleName"
} else {
  New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8000 -Profile Private
  Write-Host "Created firewall rule: $ruleName (Private networks, TCP 8000)"
}
Write-Host "Test from phone browser: http://10.10.0.16:8000/ (use your PC LAN IP if different)"
