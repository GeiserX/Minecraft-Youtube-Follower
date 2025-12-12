# PowerShell script to test locally on Windows
# This script helps set up and test the services locally on Windows

$ErrorActionPreference = "Stop"

Write-Host "Minecraft YouTube Follower - Windows Local Testing" -ForegroundColor Green
Write-Host "=" * 60

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "ERROR: .env file not found!" -ForegroundColor Red
    Write-Host "Please create .env file with your configuration:" -ForegroundColor Yellow
    Write-Host "  - Copy .env.example to .env" -ForegroundColor Yellow
    Write-Host "  - Fill in your Minecraft username, server host, and YouTube stream key" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "IMPORTANT: .env contains sensitive information and will NOT be committed to git" -ForegroundColor Cyan
    exit 1
}

Write-Host "✓ .env file found" -ForegroundColor Green

# Check Docker
Write-Host "`nChecking Docker..." -ForegroundColor Cyan
docker --version | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Check if Docker is running
docker info | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker daemon is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

Write-Host "✓ Docker is running" -ForegroundColor Green

# Create necessary directories
Write-Host "`nCreating necessary directories..." -ForegroundColor Cyan
$dirs = @(
    "bot/config",
    "bot/logs",
    "streaming/config",
    "streaming/logs",
    "mumble/config",
    "mumble/config"
)

foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  Created: $dir" -ForegroundColor Gray
    }
}

# Windows-specific notes
Write-Host "`n" -NoNewline
Write-Host "WARNING: Windows Limitations" -ForegroundColor Yellow
Write-Host "- Intel iGPU passthrough (/dev/dri) is not available on Windows"
Write-Host "- Streaming service will use software encoding (slower but works)"
Write-Host "- X11 display capture may have limitations"
Write-Host "- For production, deploy on Linux/Unraid" -ForegroundColor Yellow

Write-Host "`n" -NoNewline
Write-Host "Testing Configuration:" -ForegroundColor Cyan
Write-Host "1. Bot will connect to your Minecraft server"
Write-Host "2. First run will require Microsoft OAuth authentication"
Write-Host "3. Viewer will be available at http://localhost:3000"
Write-Host "4. Mumble server will be available on port 64738"
Write-Host "5. Streaming will go to YouTube/Twitch based on your .env"

Write-Host "`nStarting services..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

# Start services
docker-compose up

