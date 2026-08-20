# Tunely Read-Only Git Status Helper
$ErrorActionPreference = "Continue"

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host " [TUNELY SAFE GIT STATUS REPORT]" -ForegroundColor Cyan
Write-Host "==================================================`n" -ForegroundColor Cyan

# 1. Verify Git repo
$isGit = git rev-parse --is-inside-work-tree 2>$null
if ($LASTEXITCODE -ne 0 -or $isGit -ne "true") {
    Write-Host "ERROR: Not inside a valid Git repository." -ForegroundColor Red
    exit 1
}

# 2. Fetch remote silently
$null = git fetch origin main 2>&1

# 3. Branch & Commit Info
$branch = (git branch --show-current).Trim()
$localHead = (git rev-parse HEAD).Trim()
$remoteHead = (git rev-parse origin/main).Trim()
$localMsg = (git log -1 --format="%s" HEAD).Trim()
$remoteMsg = (git log -1 --format="%s" origin/main).Trim()

# 4. Ahead / Behind calculation
$counts = (git rev-list --left-right --count "$branch...origin/main").Trim().Split("`t")
$ahead = [int]$counts[0]
$behind = [int]$counts[1]

# 5. Working tree state
$porcelain = (git status --porcelain)

# 6. Stash count
$stashes = (git stash list)
$stashCount = if ($stashes) { ($stashes | Measure-Object).Count } else { 0 }

# Output Report
Write-Host "Branch:         $branch" -ForegroundColor Yellow
Write-Host "Local HEAD:     $($localHead.Substring(0,7)) - $localMsg"
Write-Host "origin/main:    $($remoteHead.Substring(0,7)) - $remoteMsg"
Write-Host "Commits Ahead:  $ahead"
Write-Host "Commits Behind: $behind"

if ($ahead -eq 0 -and $behind -eq 0) {
    Write-Host "Sync State:     UP TO DATE [MATCHES ORIGIN/MAIN]" -ForegroundColor Green
} elseif ($ahead -eq 0 -and $behind -gt 0) {
    Write-Host "Sync State:     BEHIND (Run 'npm run git:sync' to safely update)" -ForegroundColor Yellow
} elseif ($ahead -gt 0 -and $behind -eq 0) {
    Write-Host "Sync State:     AHEAD (Local commits ready to push)" -ForegroundColor Cyan
} else {
    Write-Host "Sync State:     DIVERGED (Manual merge required)" -ForegroundColor Red
}

Write-Host "`n--------------------------------------------------" -ForegroundColor Gray

if (-not $porcelain) {
    Write-Host "Working Tree:   CLEAN" -ForegroundColor Green
} else {
    Write-Host "Working Tree:   UNCOMMITTED CHANGES DETECTED" -ForegroundColor Red
    Write-Host "`nChanged / Untracked files:" -ForegroundColor Yellow
    git status --short
}

Write-Host "`nSaved Stashes:   $stashCount" -ForegroundColor Yellow
if ($stashCount -gt 0) {
    $stashes | ForEach-Object { Write-Host "   - $_" -ForegroundColor Gray }
}

Write-Host "`n==================================================`n" -ForegroundColor Cyan
