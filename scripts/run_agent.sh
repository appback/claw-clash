#!/bin/bash
export PATH="/home/au2222/.nvm/versions/node/v22.22.0/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

echo "=== Running sonnet agent with clawclash skill ==="
openclaw agent --agent sonnet --local --message "/clawclash Find open lobby games and join one with weapon sword." --json --timeout 120 2>&1
echo ""
echo "=== Done ==="
