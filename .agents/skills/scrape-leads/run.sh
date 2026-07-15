#!/usr/bin/env bash
# scrape-leads — real Apify LinkedIn scrape + optional enrichment → leads artifact.
set -euo pipefail

IN="${1:?usage: run.sh <plan.json>}"
BASE="${JARVIS_CODE_BASE_URL:-http://localhost:3000}"
RUN_DIR="${JARVIS_CODE_RUN_DIR:-$(pwd)/.jarvis-code/runs/adhoc}"
OUT_DIR="$RUN_DIR/artifacts"
mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/leads.json"

curl -sS -X POST "$BASE/api/jarvis-code/skills/leads" \
  -H 'content-type: application/json' \
  --data-binary @"$IN" \
  -o "$OUT"

# Fail loudly (no sentinel) if the response is not valid JSON.
node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$OUT" >/dev/null

echo "<<JARVIS_ARTIFACT kind=leads file=$OUT>>"
