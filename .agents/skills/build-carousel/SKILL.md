---
name: build-carousel
description: Build a swipe-through LinkedIn/Instagram carousel deck in the founder's locked brand style. Use when the user wants a carousel, slide deck, swipe post, cheatsheet, or listicle. Slide images render on-brand automatically.
---

# build-carousel

Write a carousel deck. You write the slide COPY (grounded + on-voice); the dashboard renders each slide as an on-brand image automatically (server-side, using the founder's locked brand kit + face). You never generate the images here.

## Steps

1. **Ground first.** Run `search-brain` for the topic, the founder's angle, and their voice.
2. **Align the brand voice** (optional but recommended):
   ```bash
   bash .Codex/skills/build-carousel/run.sh --brand
   ```
   prints the brand kit (accent, display name, style bible) so your copy is on-brand.
3. **Write the deck** as JSON (schema below). Aim for 5-8 slides: slide 1 is the `hook`, the last is the `cta`, the middle are `body`. Titles are short and punchy; bodies are 1-2 tight lines. Give each slide a one-line `visual` describing what should be on it.
4. **Write the deck JSON to a temp file** with the Write tool, e.g. `/tmp/carousel.json`.
5. **Finalize:**
   ```bash
   bash .Codex/skills/build-carousel/run.sh /tmp/carousel.json
   ```
   It validates + registers the artifact and prints a `<<JARVIS_ARTIFACT …>>` line. Do NOT print that line or the JSON in your answer.
6. Write your final answer as a short strategic wrapper (the hook, why it lands, where to post it) in the block grammar.

## Deck schema

```json
{
  "topic": "the deck's subject",
  "hook": "the scroll-stopping promise (also slide 1)",
  "slides": [
    { "n": 1, "kind": "hook", "title": "…", "body": "…", "layout": "statement", "visual": "…" },
    { "n": 2, "kind": "body", "title": "…", "body": "…", "layout": "split", "visual": "…" },
    { "n": 8, "kind": "cta", "title": "…", "body": "…", "layout": "stacked", "visual": "…" }
  ],
  "caption": "the post caption to publish with the deck",
  "styleBible": "optional shared visual style paragraph",
  "grounding": ["Doc titles you used"]
}
```

`layout` is one of `split | stacked | statement`. Do not fabricate the founder's stats or claims — ground them via search-brain.
