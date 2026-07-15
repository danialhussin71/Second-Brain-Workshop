#!/usr/bin/env bash
# write-newsletter — render brand-DNA HTML email + gpt-image assets → newsletter artifact.
set -euo pipefail

IN="${1:?usage: run.sh <newsletter.json>}"
BASE="${JARVIS_CODE_BASE_URL:-http://localhost:3000}"
RUN_DIR="${JARVIS_CODE_RUN_DIR:-$(pwd)/.jarvis-code/runs/adhoc}"
OUT_DIR="$RUN_DIR/artifacts"
mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/newsletter.json"

curl -sS -X POST "$BASE/api/jarvis-code/skills/newsletter" \
  -H 'content-type: application/json' \
  --data-binary @"$IN" \
  -o "$OUT"

node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$OUT" >/dev/null

echo "<<JARVIS_ARTIFACT kind=newsletter file=$OUT>>"
