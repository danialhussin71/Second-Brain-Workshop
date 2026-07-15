#!/usr/bin/env bash
# propose-action — register a write proposal for human approval (no execution).
set -euo pipefail

IN="${1:?usage: run.sh <proposal.json>}"
RUN_DIR="${JARVIS_CODE_RUN_DIR:-$(pwd)/.jarvis-code/runs/adhoc}"
OUT_DIR="$RUN_DIR/artifacts"
mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/proposal.json"

node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));if(!d.title||!d.summary)throw new Error("proposal needs title + summary");require("fs").writeFileSync(process.argv[2],JSON.stringify(d))' "$IN" "$OUT"

echo "<<JARVIS_PROPOSAL file=$OUT>>"
