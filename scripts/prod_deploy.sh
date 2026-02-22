#!/usr/bin/env bash
# ===========================================
# Claw Clash Deploy Script (Run from LOCAL)
# ===========================================
# Builds Docker images locally, transfers to EC2.
# No source code on EC2 — images + compose only.
#
# Usage (from claw-clash/ root):
#   bash scripts/deploy_clawclash.sh          # Regular deploy
#   bash scripts/deploy_clawclash.sh --init   # First-time setup (nginx + .env)
# ===========================================
set -euo pipefail

# --- Config ---
EC2_HOST="43.201.163.136"
EC2_USER="ec2-user"
KEY_FILE="../title-clash/appback.pem"
REMOTE_DIR="/home/${EC2_USER}/clawclash"
SSH_OPT="-i ${KEY_FILE} -o StrictHostKeyChecking=no"
SSH_CMD="ssh ${SSH_OPT} ${EC2_USER}@${EC2_HOST}"
SCP_CMD="scp ${SSH_OPT}"
IMAGE_TAR="/tmp/clawclash-images.tar"
DOMAIN="clash.appback.app"
INIT_MODE=false
if [ "${1:-}" = "--init" ]; then INIT_MODE=true; fi

echo "=========================================="
echo " Deploying Claw Clash to AWS"
[ "$INIT_MODE" = true ] && echo " (First-time init mode)"
echo "=========================================="

# --- 0. First-time init: nginx + .env (SSL via Cloudflare Flexible) ---
if [ "$INIT_MODE" = true ]; then
  echo "[INIT] Setting up host nginx..."
  ${SSH_CMD} "mkdir -p ${REMOTE_DIR}/docker ${REMOTE_DIR}/db/migrations"
  ${SCP_CMD} docker/nginx-host.conf ${EC2_USER}@${EC2_HOST}:${REMOTE_DIR}/docker/
  ${SSH_CMD} "sudo cp ${REMOTE_DIR}/docker/nginx-host.conf /etc/nginx/conf.d/clawclash.conf"
  ${SSH_CMD} "sudo nginx -t && sudo systemctl reload nginx"
  echo "  Nginx configured (HTTP only — Cloudflare handles SSL)."

  # Create .env if not exists
  HAS_ENV=$(${SSH_CMD} "test -f ${REMOTE_DIR}/docker/.env && echo yes || echo no")
  if [ "$HAS_ENV" = "no" ]; then
    echo "  Creating .env on EC2..."
    DB_PW=$(openssl rand -hex 16)
    JWT_SEC=$(openssl rand -hex 32)
    ${SSH_CMD} "cat > ${REMOTE_DIR}/docker/.env << 'ENVEOF'
DB_PASSWORD=${DB_PW}
JWT_SECRET=${JWT_SEC}
NODE_ENV=production
ENVEOF"
    echo "  .env created with generated secrets."
    echo "  DB_PASSWORD=${DB_PW}"
    echo "  JWT_SECRET=${JWT_SEC}"
    echo "  (Save these somewhere safe!)"
  else
    echo "  .env already exists, skipping."
  fi
fi

# --- 1. Build images locally ---
echo "[1/5] Building Docker images locally..."
# Copy shared packages into API build context
cp -r ../packages/common apps/api/_common
docker build -t clawclash-api:latest apps/api/
rm -rf apps/api/_common
docker build -t clawclash-client:latest client/
echo "  Images built."

# --- 2. Save & transfer images ---
echo "[2/5] Saving and transferring images..."
docker save clawclash-api:latest clawclash-client:latest -o "${IMAGE_TAR}"
${SCP_CMD} "${IMAGE_TAR}" ${EC2_USER}@${EC2_HOST}:/tmp/
rm -f "${IMAGE_TAR}"
echo "  Images transferred."

# --- 3. Upload compose + config + migrations, load images ---
echo "[3/5] Setting up EC2..."
${SSH_CMD} "mkdir -p ${REMOTE_DIR}/docker ${REMOTE_DIR}/db/migrations"
${SCP_CMD} docker/docker-compose.prod.yml ${EC2_USER}@${EC2_HOST}:${REMOTE_DIR}/docker/
${SCP_CMD} docker/nginx-host.conf ${EC2_USER}@${EC2_HOST}:${REMOTE_DIR}/docker/
${SCP_CMD} db/migrations/*.sql ${EC2_USER}@${EC2_HOST}:${REMOTE_DIR}/db/migrations/
${SSH_CMD} "docker load -i /tmp/clawclash-images.tar && rm -f /tmp/clawclash-images.tar"
echo "  EC2 ready."

# --- 4. Start services ---
echo "[4/5] Starting services..."
${SSH_CMD} "cd ${REMOTE_DIR}/docker && docker compose -f docker-compose.prod.yml up -d"

# Health check
DEPLOY_TS=$(${SSH_CMD} "date -u +%Y-%m-%dT%H:%M:%SZ")
echo "  Waiting for API..."
sleep 5
for i in $(seq 1 15); do
  HEALTH=$(${SSH_CMD} "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3200/health" 2>/dev/null)
  if [ "${HEALTH}" = "200" ]; then
    echo "  API: OK (attempt $i)"
    break
  fi
  if [ "$i" -eq 15 ]; then
    echo "  WARNING: API health check failed (HTTP ${HEALTH})"
    ${SSH_CMD} "cd ${REMOTE_DIR}/docker && docker compose -f docker-compose.prod.yml logs --since=${DEPLOY_TS} api"
  else
    echo "  Attempt $i/15 (HTTP ${HEALTH})..."
    sleep 2
  fi
done

# --- 5. Status ---
echo "[5/5] Service status:"
${SSH_CMD} "cd ${REMOTE_DIR}/docker && docker compose -f docker-compose.prod.yml ps"

echo ""
echo "=========================================="
echo " Deploy Complete!"
echo "=========================================="
echo " https://${DOMAIN}"
echo "=========================================="
