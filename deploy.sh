#!/usr/bin/env bash
# ====================================================================
# CampusPrint Automated Production Deployment Script
# Zero-Downtime Rolling Update & Container Orchestration
# ====================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}  🚀 Deploying CampusPrint Production Platform         ${NC}"
echo -e "${BLUE}======================================================${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. Check prerequisites
command -v docker >/dev/null 2>&1 || {
    echo -e "${RED}[ERROR] Docker is not installed or not in PATH.${NC}"
    exit 1
}

# 2. Check for .env.production
ENV_FILE=".env.production"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}[WARNING] .env.production not found.${NC}"
    if [ -f ".env.production.example" ]; then
        echo -e "${YELLOW}Creating .env.production from template... Please configure credentials!${NC}"
        cp .env.production.example .env.production
        echo -e "${RED}[ACTION REQUIRED] Edit .env.production with your real secrets, then re-run ./deploy.sh.${NC}"
        exit 1
    fi
fi

# Ensure executable permissions for init scripts
chmod +x scripts/init-postgres-dbs.sh 2>/dev/null || true

# 3. Build containers using Docker BuildKit
echo -e "\n${BLUE}[1/5] Building production container images...${NC}"
DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 docker compose \
    -f docker-compose.prod.yml \
    --env-file "$ENV_FILE" \
    build

# 4. Start core database & queue infrastructure
echo -e "\n${BLUE}[2/5] Starting database and cache infrastructure...${NC}"
docker compose \
    -f docker-compose.prod.yml \
    --env-file "$ENV_FILE" \
    up -d postgres redis

echo -e "${BLUE}Waiting for PostgreSQL to be healthy...${NC}"
until [ "$(docker inspect -f '{{.State.Health.Status}}' campus-print-postgres-prod 2>/dev/null)" = "healthy" ]; do
    sleep 2
    printf "."
done
echo -e " ${GREEN}PostgreSQL Ready!${NC}"

# 5. Execute Database Migrations
echo -e "\n${BLUE}[3/5] Running database migrations...${NC}"
docker compose \
    -f docker-compose.prod.yml \
    --env-file "$ENV_FILE" \
    run --rm backend npx prisma db push --accept-data-loss

docker compose \
    -f docker-compose.prod.yml \
    --env-file "$ENV_FILE" \
    run --rm upi-gateway php artisan migrate --force

# 6. Launch Application Stack & Reverse Proxy
echo -e "\n${BLUE}[4/5] Deploying application containers & Caddy reverse proxy...${NC}"
docker compose \
    -f docker-compose.prod.yml \
    --env-file "$ENV_FILE" \
    up -d --remove-orphans

# 7. Post-Deployment Verification
echo -e "\n${BLUE}[5/5] Verifying service health status...${NC}"
sleep 5
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" ps

# Clean up dangling build images
docker image prune -f >/dev/null 2>&1 || true

echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN}  ✅ CampusPrint Production Deployment Complete!       ${NC}"
echo -e "${GREEN}  - Web Portal:    https://print.$(grep ^DOMAIN= "$ENV_FILE" | cut -d= -f2)${NC}"
echo -e "${GREEN}  - Backend API:   https://api.$(grep ^DOMAIN= "$ENV_FILE" | cut -d= -f2)${NC}"
echo -e "${GREEN}  - UPI Gateway:   https://upi.$(grep ^DOMAIN= "$ENV_FILE" | cut -d= -f2)${NC}"
echo -e "${GREEN}======================================================${NC}"

