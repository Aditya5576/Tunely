# PowerShell script to push local updates to GitHub
Write-Host "Staging all changes..." -ForegroundColor Cyan
git add .

$defaultMessage = "Sync updates from " + $env:COMPUTERNAME + " on " + (Get-Date -Format "yyyy-MM-dd HH:mm")
$commitMessage = Read-Host "Enter commit message (Press Enter for default: '$defaultMessage')"

if ([string]::IsNullOrWhiteSpace($commitMessage)) {
    $commitMessage = $defaultMessage
}

Write-Host "Committing changes..." -ForegroundColor Cyan
git commit -m $commitMessage

Write-Host "Pushing changes to GitHub..." -ForegroundColor Cyan
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "Successfully pushed and synced with GitHub!" -ForegroundColor Green
} else {
    Write-Host "Failed to push changes. Check your connection or remote state." -ForegroundColor Red
}
pause
