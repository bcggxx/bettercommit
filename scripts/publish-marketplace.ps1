# BetterCommit — Publish to VS Code Marketplace
# Reads PAT_TOKEN from .env file
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSCommandPath | Split-Path -Parent
Set-Location $projectRoot

Write-Host "`n=== BetterCommit Marketplace Publish ===" -ForegroundColor Cyan

# Read .env
$envPath = Join-Path $projectRoot ".env"
if (-not (Test-Path $envPath)) {
    Write-Host "ERROR: .env file not found at $envPath" -ForegroundColor Red
    Write-Host "Create .env with: PAT_TOKEN=your_azure_devops_pat" -ForegroundColor Gray
    exit 1
}

$token = $null
Get-Content $envPath | ForEach-Object {
    if ($_ -match '^\s*PAT_TOKEN\s*=\s*(.+?)\s*$') {
        $token = $matches[1]
    }
}

if (-not $token -or $token -eq 'your_azure_devops_pat_here') {
    Write-Host "ERROR: PAT_TOKEN not set in .env" -ForegroundColor Red
    Write-Host "Edit .env and replace with your Azure DevOps PAT" -ForegroundColor Gray
    # TODO(publisher): The URL below still points at the original fork author's
    # Azure DevOps organization (cihatksm). Before publishing to the Marketplace
    # under the `bcggxx` publisher, replace it with your own Azure DevOps org URL
    # and create a PAT with the "Marketplace > Manage" scope there.
    Write-Host "  Get one at: https://dev.azure.com/cihatksm → User Settings → PAT" -ForegroundColor Gray
    Write-Host "  Scope: Marketplace > Manage" -ForegroundColor Gray
    exit 1
}

Write-Host "[1/2] Packaging..." -ForegroundColor Yellow
$vsixOutput = npx @vscode/vsce package 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host $vsixOutput
    throw "Packaging failed"
}
Write-Host $vsixOutput -ForegroundColor Gray

Write-Host "[2/2] Publishing to Marketplace..." -ForegroundColor Yellow
npx @vscode/vsce publish -p $token 2>&1
if ($LASTEXITCODE -ne 0) { throw "Publish failed" }

$pkg = Get-Content package.json | ConvertFrom-Json
Write-Host "`nPublished v$($pkg.version) to Marketplace!" -ForegroundColor Green
