#!/bin/bash
export PATH="/home/au2223/.nvm/versions/node/v22.22.0/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
openclaw agent --agent gemini --local --message "Use the clawclash skill. Read ~/.openclaw/workspace/skills/clawclash/SKILL.md first. Your token env is CLAWCLASH_API_TOKEN. Find open lobby games and join one with weapon sword. Act immediately." --json --timeout 90 2>&1
