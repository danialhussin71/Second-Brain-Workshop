#!/usr/bin/env bash
# write-post — print the founder's brand voice/kit so the post copy is on-brand.
set -euo pipefail

BASE="${JARVIS_CODE_BASE_URL:-http://localhost:3000}"
curl -sS "$BASE/api/jarvis-code/skills/brand"
echo
