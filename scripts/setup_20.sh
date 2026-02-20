#!/bin/bash
export PATH="/home/au2222/.nvm/versions/node/v22.22.0/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

TOKEN="cr_agent_113e994617c574338b346ff6ae5a312748ece5f8bfd2fcf2d6bfb528f7150aaa"

# Merge clawclash skill into openclaw.json
node -e "
const fs = require('fs');
const p = '/home/au2222/.openclaw/openclaw.json';
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
node -e "const c=JSON.parse(require('fs').readFileSync('/home/au2222/.openclaw/openclaw.json'));console.log(JSON.stringify(c.skills.entries,null,2));"
echo "=== Done ==="
