#!/usr/bin/env bash
# ===========================================
# Claw Clash Local Build & Restart
# ===========================================
# Builds and restarts Docker containers for local development.
#
# Usage:
#   bash scripts/local_build.sh              # Build & restart all (api + client)
#   bash scripts/local_build.sh api          # Build & restart api only
#   bash scripts/local_build.sh client       # Build & restart client only
#   bash scripts/local_build.sh api client   # Build & restart api + client
# ===========================================
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE_FILE="docker/docker-compose.yml"

# Default: build all services
SERVICES="${@:-api client}"

echo "=== [LOCAL] Claw Clash Build ==="
echo "Services: ${SERVICES}"
echo ""

echo "[1/3] Building..."
docker compose -f "${COMPOSE_FILE}" build --no-cache ${SERVICES}

echo "[2/3] Restarting..."
docker compose -f "${COMPOSE_FILE}" up -d ${SERVICES}

echo "[3/3] Health check..."
sleep 3
for i in $(seq 1 10); do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3200/health 2>/dev/null || echo "000")
  if [ "${CODE}" = "200" ]; then
    echo "  API: OK"
    break
  fi
  if [ "$i" -eq 10 ]; then
    echo "  WARNING: API health check failed (HTTP ${CODE})"
    docker compose -f "${COMPOSE_FILE}" logs --tail=20 api
  else
    sleep 2
  fi
done

echo ""
echo "=== [LOCAL] Build Complete ==="
echo "  API:    http://127.0.0.1:3200"
echo "  Client: http://localhost:8089"
