---
name: write-newsletter
description: Write a light-themed, brand-DNA HTML email newsletter with optional editorial illustrations. Use when the user wants an email newsletter, broadcast, weekly email, or email issue.
---

# write-newsletter

Write an email newsletter. You write the CONTENT and the illustration concepts on the founder's subscription; the skill renders up to two light-themed gpt-image illustrations and fills the brand-DNA HTML template, returning a ready-to-send email the dashboard shows in an iframe.

## Steps

1. **Ground first.** Run `search-brain` for the topic, the founder's newsletter voice, and any playbook.
2. **Write the issue** as JSON (schema below). Keep it in the founder's voice: a strong subject, a warm intro, 2-4 sections, an optional pull-quote, one clear CTA. Provide a `heroPrompt` (a concept for the hero illustration) and optionally `inlinePrompt` for a second one.
3. **Write the JSON to a temp file** with the Write tool, e.g. `/tmp/newsletter.json`.
4. **Render it:**
   ```bash
   bash .Codex/skills/write-newsletter/run.sh /tmp/newsletter.json
   ```
   It builds the HTML + images, writes the artifact, and prints a `<<JARVIS_ARTIFACT …>>` line. Do NOT print that line or the JSON in your answer.
5. Write your final answer as a short strategic note (the angle, who it's for, the one CTA) in the block grammar.

## Content schema

```json
{
  "kicker": "small eyebrow above the title",
  "subject": "the email subject line",
  "preview": "inbox preview text",
  "title": "the headline inside the email",
  "intro": "opening paragraphs (blank line between paragraphs)",
  "sections": [
    { "heading": "Section heading", "body": "paragraphs; supports '- ' bullets, '### ' subheads, **bold**" }
  ],
  "quote": "optional centered pull-quote",
  "cta": { "label": "Button text", "url": "https://…" },
  "signoff": "how the founder signs off",
  "ps": "optional P.S.",
  "heroPrompt": "concept for the hero illustration (no text in the image)",
  "inlinePrompt": "optional concept for a second inline illustration",
  "grounding": ["Doc titles you used"]
}
```

If image generation is not configured (`OPENAI_API_KEY` missing) the email still renders, text-only. Never invent facts about the founder's business.
