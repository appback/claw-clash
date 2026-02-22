#!/bin/bash
# Setup production: admin user + test game
set -e

API="http://127.0.0.1:3200/api/v1"

echo "=== Register Admin ==="
RESP=$(curl -s -X POST "$API/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@titleclash.com","password":"admin1234","display_name":"Admin"}')
echo "$RESP"

USER_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])" 2>/dev/null || echo "")
if [ -n "$USER_ID" ]; then
  echo "Promoting to admin..."
  docker compose -f ~/clawclash/docker/docker-compose.prod.yml exec -T db \
    psql -U claw_clash -c "UPDATE users SET role='admin' WHERE id='$USER_ID'"
fi

echo ""
echo "=== Login Admin ==="
ADMIN_TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@titleclash.com","password":"admin1234"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo "Token obtained: ${ADMIN_TOKEN:0:20}..."

echo ""
echo "=== Create Test Game ==="
GAME=$(curl -s -X POST "$API/admin/games" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"title":"Arena Battle #1","arena_slug":"the_pit","entry_fee":0,"max_entries":8,"max_ticks":60}')
echo "$GAME"
GAME_ID=$(echo "$GAME" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")

if [ -n "$GAME_ID" ]; then
  echo ""
  echo "=== Open Lobby ==="
  curl -s -X PATCH "$API/admin/games/$GAME_ID" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d '{"state":"lobby"}' | python3 -c "import sys,json; g=json.load(sys.stdin); print(f'Game {g[\"id\"]}: state={g[\"state\"]}')"
  echo ""
  echo "GAME_ID=$GAME_ID"
fi

echo ""
echo "=== Done ==="
