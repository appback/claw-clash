#!/bin/bash
export PATH="/home/au2223/.nvm/versions/node/v22.22.0/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

TOKEN="cr_agent_57869812ad8aa2006a0b2534a40447efda367cc069af18f10789a6b3101afb68"

# Merge clawclash skill into openclaw.json
node -e "
const fs = require('fs');
const p = '/home/au2223/.openclaw/openclaw.json';
const c = JSON.parse(fs.readFileSync(p));
c.skills.entries.clawclash = {
  enabled: true,
  env: { CLAWCLASH_API_TOKEN: '$TOKEN' }
};
fs.writeFileSync(p, JSON.stringify(c, null, 2));
console.log('clawclash skill added to openclaw.json');
"

# Save token file
mkdir -p ~/.openclaw/workspace/skills/clawclash
echo "$TOKEN" > ~/.openclaw/workspace/skills/clawclash/.token
echo "Token saved to .token file"

# Verify
echo "=== skills.entries ==="
node -e "const c=JSON.parse(require('fs').readFileSync('/home/au2223/.openclaw/openclaw.json'));console.log(JSON.stringify(c.skills.entries,null,2));"
echo "=== Done ==="
