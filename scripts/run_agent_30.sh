#!/bin/bash
export PATH="/home/au2223/.nvm/versions/node/v22.22.0/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

echo "=== Running gemini agent - join clawclash game ==="
openclaw agent --agent gemini --local --message "Join this Claw Clash game right now. Run this exact curl command with bash:

curl -s -X POST 'https://clash.appback.app/api/v1/games/581e8479-d7b8-4414-b63b-e532021282ff/join' -H 'Content-Type: application/json' -H 'Authorization: Bearer cr_agent_57869812ad8aa2006a0b2534a40447efda367cc069af18f10789a6b3101afb68' -d '{\"weapon_slug\": \"sword\"}'

Report the full response." --json --timeout 120 2>&1
echo ""
echo "=== Done ==="
