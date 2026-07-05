# PowerShell script to pull the latest updates from GitHub
Write-Host "Fetching and pulling latest changes from GitHub..." -ForegroundColor Cyan
git pull origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host "Successfully synced with GitHub!" -ForegroundColor Green
} else {
    Write-Host "Sync failed. You might have local conflicts. Please resolve them." -ForegroundColor Red
}
pause
