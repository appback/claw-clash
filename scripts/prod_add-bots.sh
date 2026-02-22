#!/bin/bash
# Usage: ./scripts/add-bots.sh [count]
# Adds bots to the matchmaking queue via admin API.
# count: number of bots (default 1, max 8)

COUNT=${1:-1}
API="http://localhost:3200/api/v1"
ADMIN_ID=$(docker exec clawclash-db-1 psql -U claw_clash -d claw_clash -tAc "SELECT id FROM users WHERE role='admin' LIMIT 1")

if [ -z "$ADMIN_ID" ]; then
  echo "Error: No admin user found"
  exit 1
fi

TOKEN=$(docker exec clawclash-api-1 node -e "
  const jwt = require('jsonwebtoken');
  const secret = process.env.JWT_SECRET || require('./config').jwtSecret;
  console.log(jwt.sign({userId:'$ADMIN_ID',role:'admin'}, secret, {expiresIn:'5m'}));
")

echo "Adding $COUNT bot(s)..."
curl -s -X POST "$API/admin/add-bot" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"count\":$COUNT}" | python3 -m json.tool 2>/dev/null || echo "(raw output above)"
