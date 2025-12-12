# PowerShell script to test locally on Windows
# This script helps set up and test the services locally

$ErrorActionPreference = "Stop"

Write-Host "Minecraft YouTube Follower - Local Testing Setup" -ForegroundColor Green
Write-Host "=" * 60

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "Creating .env file from template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "Please edit .env file with your configuration" -ForegroundColor Yellow
    Write-Host "Press any key to continue after editing .env..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Check Docker
Write-Host "Checking Docker..." -ForegroundColor Cyan
docker --version | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Check if Docker is running
docker info | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker daemon is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

Write-Host "Docker is running" -ForegroundColor Green

# Pull images or build locally
Write-Host "`nDo you want to:" -ForegroundColor Yellow
Write-Host "1. Pull images from Docker Hub (requires images to be pushed first)"
Write-Host "2. Build images locally"
$choice = Read-Host "Enter choice (1 or 2)"

if ($choice -eq "1") {
    Write-Host "Pulling images from Docker Hub..." -ForegroundColor Cyan
    docker-compose pull
} else {
    Write-Host "Building images locally..." -ForegroundColor Cyan
    docker-compose build
}

# Create necessary directories
Write-Host "Creating necessary directories..." -ForegroundColor Cyan
$dirs = @(
    "bot/config",
    "bot/logs",
    "streaming/config",
    "streaming/logs",
    "mumble/config"
)

foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "Created: $dir" -ForegroundColor Gray
    }
}

# Note about Windows limitations
Write-Host "`n" -NoNewline
Write-Host "WARNING: Windows Limitations" -ForegroundColor Yellow
Write-Host "- Intel iGPU passthrough (/dev/dri) is not available on Windows"
Write-Host "- Streaming service will use software encoding (slower)"
Write-Host "- For production, deploy on Linux/Unraid" -ForegroundColor Yellow

Write-Host "`nStarting services..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

# Start services
docker-compose up


