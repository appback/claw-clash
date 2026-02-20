#!/bin/bash
set -e
API="http://127.0.0.1:3200/api/v1"

echo "=== Login Admin ==="
RESP=$(curl -s -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@titleclash.com","password":"admin1234"}')
echo "$RESP"

TOKEN=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null || echo "")
if [ -z "$TOKEN" ]; then
  echo "ERROR: Failed to get token"
  exit 1
fi
echo "Token: ${TOKEN:0:20}..."

echo ""
echo "=== Create Test Game ==="
GAME=$(curl -s -X POST "$API/admin/games" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Arena Battle #1","arena_slug":"the_pit","entry_fee":0,"max_entries":8,"max_ticks":60}')
echo "$GAME"

GAME_ID=$(echo "$GAME" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")
if [ -z "$GAME_ID" ]; then
  echo "ERROR: Failed to create game"
  exit 1
fi

echo ""
echo "=== Open Lobby ==="
LOBBY=$(curl -s -X PATCH "$API/admin/games/$GAME_ID" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"state":"lobby"}')
echo "$LOBBY"

echo ""
echo "GAME_ID=$GAME_ID"
echo "=== Done ==="
