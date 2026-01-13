$WshShell = New-Object -ComObject WScript.Shell
$ShortcutPath = Join-Path ([System.Environment]::GetFolderPath('Desktop')) "Famili Control Center.lnk"
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)

# Logic: Launch powershell, change directory, and run the panel
$Shortcut.TargetPath = "powershell.exe"
$Shortcut.Arguments = "-NoExit -Command ""cd 'D:\444'; npm run panel"""
$Shortcut.WorkingDirectory = "D:\444"
$Shortcut.Description = "Famili Rewards Ultimate Control Center"

# Note: Applying PNG directly to a shortcut icon often requires manual refresh or .ico format.
# We set the path anyway as a hint for Windows.
$Shortcut.IconLocation = "D:\444\assets\branding\icon.png" 
$Shortcut.Save()

Write-Host "--- SUCCESS ---" -ForegroundColor Green
Write-Host "Shortcut 'Famili Control Center' created on Desktop." -ForegroundColor White
Write-Host "Icon saved to: D:\444\assets\branding\icon.png" -ForegroundColor Gray
