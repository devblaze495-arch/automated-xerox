# ====================================================================
# CampusPrint Automated Production Deployment Script (PowerShell)
# ====================================================================

[CmdletBinding()]
param (
    [string]$EnvFile = ".env.production"
)

$ErrorActionPreference = "Stop"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  🚀 Deploying CampusPrint Production Platform        " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# 1. Check prerequisites
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Docker is not installed or not found in PATH." -ForegroundColor Red
    exit 1
}

# 2. Check for environment file
if (-not (Test-Path $EnvFile)) {
    Write-Host "[WARNING] $EnvFile not found." -ForegroundColor Yellow
    if (Test-Path ".env.production.example") {
        Copy-Item ".env.production.example" -Destination ".env.production"
        Write-Host "[ACTION REQUIRED] Created .env.production from template. Configure secrets and re-run deploy.ps1." -ForegroundColor Red
        exit 1
    }
}

# 3. Build containers
Write-Host "`n[1/5] Building production container images..." -ForegroundColor Cyan
$env:DOCKER_BUILDKIT = "1"
$env:COMPOSE_DOCKER_CLI_BUILD = "1"
docker compose -f docker-compose.prod.yml --env-file $EnvFile build

# 4. Start database & cache
Write-Host "`n[2/5] Starting database and cache infrastructure..." -ForegroundColor Cyan
docker compose -f docker-compose.prod.yml --env-file $EnvFile up -d postgres redis

Write-Host "Waiting for PostgreSQL to become healthy..." -ForegroundColor Cyan
$retries = 30
while ($retries -gt 0) {
    $status = docker inspect -f '{{.State.Health.Status}}' campus-print-postgres-prod 2>$null
    if ($status -eq "healthy") {
        Write-Host " PostgreSQL Ready!" -ForegroundColor Green
        break
    }
    Start-Sleep -Seconds 2
    Write-Host -NoNewline "."
    $retries--
}

# 5. Run Database Migrations
Write-Host "`n[3/5] Executing database migrations..." -ForegroundColor Cyan
docker compose -f docker-compose.prod.yml --env-file $EnvFile run --rm backend npx prisma db push --accept-data-loss
docker compose -f docker-compose.prod.yml --env-file $EnvFile run --rm upi-gateway php artisan migrate --force

# 6. Start Application Stack & Reverse Proxy
Write-Host "`n[4/5] Deploying application containers & Caddy reverse proxy..." -ForegroundColor Cyan
docker compose -f docker-compose.prod.yml --env-file $EnvFile up -d --remove-orphans

# 7. Verification
Write-Host "`n[5/5] Verifying service health status..." -ForegroundColor Cyan
Start-Sleep -Seconds 5
docker compose -f docker-compose.prod.yml --env-file $EnvFile ps

# Clean up dangling build images
docker image prune -f | Out-Null

Write-Host "`n======================================================" -ForegroundColor Green
Write-Host "  ✅ CampusPrint Production Deployment Complete!      " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green

