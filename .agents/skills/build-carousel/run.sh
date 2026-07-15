#!/usr/bin/env bash
# build-carousel — validate the deck copy → carousel artifact (images render client-side).
set -euo pipefail

BASE="${JARVIS_CODE_BASE_URL:-http://localhost:3000}"

# `--brand` mode: print the brand kit so the copy can be on-brand.
if [ "${1:-}" = "--brand" ]; then
  curl -sS "$BASE/api/jarvis-code/skills/brand"
  echo
  exit 0
fi

IN="${1:?usage: run.sh <deck.json>  (or --brand)}"
RUN_DIR="${JARVIS_CODE_RUN_DIR:-$(pwd)/.jarvis-code/runs/adhoc}"
OUT_DIR="$RUN_DIR/artifacts"
mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/carousel.json"

# Validate the deck has slides, then normalize it into the artifact file.
node -e '
  const fs = require("fs");
  const d = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (!Array.isArray(d.slides) || d.slides.length === 0) throw new Error("deck has no slides");
  d.slides = d.slides.map((s, i) => ({ n: s.n ?? i + 1, kind: s.kind || (i === 0 ? "hook" : i === d.slides.length - 1 ? "cta" : "body"), title: s.title || "", body: s.body || "", layout: s.layout, visual: s.visual, logos: s.logos }));
  d.grounding = Array.isArray(d.grounding) ? d.grounding : [];
  fs.writeFileSync(process.argv[2], JSON.stringify(d));
' "$IN" "$OUT"

echo "<<JARVIS_ARTIFACT kind=carousel file=$OUT>>"
