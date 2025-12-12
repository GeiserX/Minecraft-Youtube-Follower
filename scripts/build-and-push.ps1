# PowerShell script to build and push Docker images
# Run this from the project root directory

$ErrorActionPreference = "Stop"

Write-Host "Building and pushing Docker images..." -ForegroundColor Green

# Check if logged into Docker Hub
Write-Host "Checking Docker Hub login..." -ForegroundColor Yellow
docker info | Select-String -Pattern "Username" | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Please login to Docker Hub first: docker login" -ForegroundColor Red
    exit 1
}

# Build and push bot image
Write-Host "Building minecraft-spectator-bot:0.1.0..." -ForegroundColor Cyan
docker build -t drumsergio/minecraft-spectator-bot:0.1.0 ./bot
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to build bot image" -ForegroundColor Red
    exit 1
}
Write-Host "Pushing minecraft-spectator-bot:0.1.0..." -ForegroundColor Cyan
docker push drumsergio/minecraft-spectator-bot:0.1.0
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to push bot image" -ForegroundColor Red
    exit 1
}

# Build and push streaming image
Write-Host "Building minecraft-streaming-service:0.1.0..." -ForegroundColor Cyan
docker build -t drumsergio/minecraft-streaming-service:0.1.0 ./streaming
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to build streaming image" -ForegroundColor Red
    exit 1
}
Write-Host "Pushing minecraft-streaming-service:0.1.0..." -ForegroundColor Cyan
docker push drumsergio/minecraft-streaming-service:0.1.0
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to push streaming image" -ForegroundColor Red
    exit 1
}

# Note: Mumble server uses official image, no build needed
Write-Host "Mumble server uses official mumblevoip/mumble-server image" -ForegroundColor Cyan

Write-Host "All images built and pushed successfully!" -ForegroundColor Green


