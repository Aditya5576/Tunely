# Tunely Safe Two-Laptop Git Synchronization Script
$ErrorActionPreference = "Continue"

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host " [TUNELY SAFE TWO-LAPTOP GIT SYNCHRONIZATION]" -ForegroundColor Cyan
Write-Host "==================================================`n" -ForegroundColor Cyan

# 1. Verify Git repo
$isGit = git rev-parse --is-inside-work-tree 2>$null
if ($LASTEXITCODE -ne 0 -or $isGit -ne "true") {
    Write-Host "ERROR: Not inside a valid Git repository." -ForegroundColor Red
    exit 1
}

# 2. Verify current branch is main
$currentBranch = (git branch --show-current).Trim()
if ($currentBranch -ne "main") {
    Write-Host "STOPPED FOR SAFETY: Current branch is '$currentBranch' (expected 'main')." -ForegroundColor Red
    Write-Host "Please switch to main before running synchronization." -ForegroundColor Yellow
    exit 1
}

# 3. Fetch latest origin/main
Write-Host "Fetching latest origin/main from GitHub..." -ForegroundColor Yellow
$null = git fetch origin main 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to fetch from origin. Check network connectivity." -ForegroundColor Red
    exit 1
}

# 4. Inspect working tree state (filter out untracked scripts/ if necessary or check porcelain)
$porcelain = (git status --porcelain)
# Ignore the sync tool script files if uncommitted before initial commit
$uncommittedLines = $porcelain | Where-Object { 
    $_ -notmatch "package\.json" -and 
    $_ -notmatch "package-lock\.json" -and 
    $_ -notmatch "scripts/sync-tunely\.ps1" -and 
    $_ -notmatch "scripts/tunely-status\.ps1" 
}

if ($uncommittedLines) {
    Write-Host "`nSTOPPED FOR SAFETY: Working tree has uncommitted local changes." -ForegroundColor Red
    Write-Host "To prevent accidental data loss, synchronization cannot proceed automatically.`n" -ForegroundColor Yellow
    Write-Host "Uncommitted / Untracked files:" -ForegroundColor Yellow
    git status --short
    Write-Host "`nPlease commit, stash, or review your local changes before synchronizing." -ForegroundColor Cyan
    exit 1
}

# 5. Compare HEAD vs origin/main
$localHead = (git rev-parse HEAD).Trim()
$remoteHead = (git rev-parse origin/main).Trim()
$counts = (git rev-list --left-right --count main...origin/main).Trim().Split("`t")
$ahead = [int]$counts[0]
$behind = [int]$counts[1]

if ($ahead -eq 0 -and $behind -eq 0) {
    Write-Host "`nALREADY SYNCHRONIZED!" -ForegroundColor Green
    Write-Host "Local HEAD ($($localHead.Substring(0,7))) matches origin/main ($($remoteHead.Substring(0,7)))." -ForegroundColor Green
    Write-Host "Working tree is clean. Ready to work!" -ForegroundColor Green
    exit 0
}

if ($ahead -gt 0 -and $behind -eq 0) {
    Write-Host "`nLOCAL COMMITS READY TO PUSH" -ForegroundColor Cyan
    Write-Host "This laptop has $ahead local commit(s) ahead of origin/main." -ForegroundColor Cyan
    Write-Host "To push your changes to GitHub, run:" -ForegroundColor Yellow
    Write-Host "  git push origin main`n" -ForegroundColor Yellow
    exit 0
}

if ($ahead -gt 0 -and $behind -gt 0) {
    Write-Host "`nSTOPPED FOR SAFETY: Branches have diverged!" -ForegroundColor Red
    Write-Host "This laptop is $ahead commit(s) ahead and $behind commit(s) behind origin/main." -ForegroundColor Red
    Write-Host "Automatic merge is disabled to prevent accidental conflicts. Please resolve manually.`n" -ForegroundColor Yellow
    exit 1
}

# 6. Local is behind — Fast-Forward Pull
if ($ahead -eq 0 -and $behind -gt 0) {
    Write-Host "`nUpdating local repository ($behind new commit(s) available on origin/main)..." -ForegroundColor Yellow
    
    # Check if dependencies lockfile will change
    $diffFiles = git diff --name-only HEAD origin/main
    $lockChanged = $diffFiles | Select-String -Pattern "^package(-lock)?\.json$"

    # Execute ONLY safe fast-forward pull
    git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Fast-forward pull failed. Check git output above." -ForegroundColor Red
        exit 1
    }

    # Verify sync result
    $newLocalHead = (git rev-parse HEAD).Trim()
    $newRemoteHead = (git rev-parse origin/main).Trim()
    
    if ($newLocalHead -ne $newRemoteHead) {
        Write-Host "ERROR: Post-sync SHA mismatch ($newLocalHead vs $newRemoteHead)." -ForegroundColor Red
        exit 1
    }

    # Run npm ci only if lockfile changed
    if ($lockChanged) {
        Write-Host "`nDependencies updated in latest commits. Running 'npm ci'..." -ForegroundColor Yellow
        npm ci
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: 'npm ci' failed during dependency installation." -ForegroundColor Red
            exit 1
        }
    }

    Write-Host "`n==================================================" -ForegroundColor Green
    Write-Host " SYNCHRONIZATION SUCCESSFUL!" -ForegroundColor Green
    Write-Host "==================================================" -ForegroundColor Green
    Write-Host "Branch:      $currentBranch" -ForegroundColor Green
    Write-Host "Local HEAD:  $($newLocalHead.Substring(0,7))" -ForegroundColor Green
    Write-Host "origin/main: $($newRemoteHead.Substring(0,7))" -ForegroundColor Green
    Write-Host "Working Tree: CLEAN" -ForegroundColor Green
}
