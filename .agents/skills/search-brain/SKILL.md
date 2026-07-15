---
name: search-brain
description: Ground an answer in the founder's own second brain (Obsidian vault + knowledge docs, hybrid keyword + vector search over Supabase). Use FIRST for anything about their ICP, positioning, offer, voice, frameworks, or past work before writing or deciding.
---

# search-brain

Retrieve the founder's real knowledge so your work is grounded in THEM, not generic advice. This runs a hybrid keyword + semantic (vector) search over the founder's second brain.

## When to use

Run this early for almost any substantive task: writing a post/carousel/newsletter, designing a lead ICP, answering a strategy question. Pull the founder's actual positioning, ICP, offer, and voice before you produce anything.

## How to run

```bash
bash .Codex/skills/search-brain/run.sh "<your search query>" [limit]
```

- Pass a focused query (e.g. `"ideal customer profile and buying signals"`, `"content voice and tone rules"`, `"core offer and pricing"`).
- Optional second arg is the number of results (default 8).
- It prints JSON with the top matching notes/chunks.

## What to do with the result

- Read the returned notes and let them shape everything downstream.
- Run it 2-3 times with different queries when the task spans several topics (e.g. ICP, then voice, then offer).
- Cite what you actually used inline in your final answer as `[[Doc Title]]`.
- If it returns nothing useful, say so briefly and proceed with clearly-labelled sensible assumptions.
