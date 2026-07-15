#!/usr/bin/env bash
# search-brain — hybrid keyword + vector search over the founder's second brain.
set -euo pipefail

QUERY="${1:-}"
LIMIT="${2:-8}"
BASE="${JARVIS_CODE_BASE_URL:-http://localhost:3000}"

if [ -z "$QUERY" ]; then
  echo "usage: run.sh <query> [limit]" >&2
  exit 1
fi

BODY=$(node -e 'process.stdout.write(JSON.stringify({query:process.argv[1],limit:Number(process.argv[2])||8}))' "$QUERY" "$LIMIT")

curl -sS -X POST "$BASE/api/brain/search" \
  -H 'content-type: application/json' \
  -d "$BODY"
echo
