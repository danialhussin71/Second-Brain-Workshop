---
name: write-post
description: Write a single text post (LinkedIn / X / thread) in the founder's voice. Use when the user wants one text post, a hook, a thread, or short written content (no images or decks).
---

# write-post

Write one text post in the founder's voice. The post IS your final answer, rendered as premium blocks; there is no separate artifact.

## Steps

1. **Ground first.** Run `search-brain` for the topic, the founder's angle, and prior posts.
2. **Align the voice** (recommended):
   ```bash
   bash .Codex/skills/write-post/run.sh
   ```
   prints the brand kit (display name, handle, voice/style bible) so the copy sounds like them.
3. **Write the post.** Present your final answer in the block grammar:
   - Open with a `# ` title naming the angle and a one-line framing.
   - Put the ready-to-publish post inside a `[[quote:Draft]] … [[/quote]]` block (verbatim, publishable as-is).
   - Add an `[[idea]]` block capturing the hook / angle / format / why.
   - Close with `[[actions]]` for how to post it (best time, first comment, a variant to test).

## Rules

- Match the founder's real voice and claims; do not invent stats.
- No em-dashes.
- Keep the post tight and native to the platform. Give one strong post, not five weak options.
