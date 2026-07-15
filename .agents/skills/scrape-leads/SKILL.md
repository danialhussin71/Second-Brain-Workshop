---
name: scrape-leads
description: Scrape a REAL LinkedIn prospect list for a described ICP via Apify, with optional enrichment (deep profile, recent activity, verified email). Use when the user wants leads, prospects, an outreach list, or a targeted people search.
---

# scrape-leads

Turn the founder's ICP into an executable LinkedIn people-search and pull real prospects. You design the targeting; the skill runs the paid scrape and returns the deliverable the dashboard renders.

## Steps

1. **Ground first.** Run `search-brain` for the founder's ICP, offer, and buying signals so the targeting is real, not generic.
2. **Design the search.** Compose a JSON plan (schema below). `searchQuery` is REQUIRED and must combine the target role with the niche (e.g. `"Head of Growth B2B SaaS"`). Map seniority/functions/companySize to the allowed labels only. Set `count` to what the user asked for (default 25, max 100). Set `findEmails`/`enrich` true only if the user wants emails or outreach-ready data.
3. **Write the plan to a temp file** with the Write tool, e.g. `/tmp/leads-plan.json`.
4. **Run the scrape:**
   ```bash
   bash .Codex/skills/scrape-leads/run.sh /tmp/leads-plan.json
   ```
5. The skill scrapes + (optionally) enriches, writes the artifact, and prints a `<<JARVIS_ARTIFACT …>>` line. Do NOT print that line or the artifact JSON in your answer.
6. Write your final answer as a tight strategic brief around the list (who we targeted, why, and the outreach angle) in the block grammar.

## Plan schema

```json
{
  "icp": "one-line ICP",
  "criteria": ["plain-English targeting criteria"],
  "qualification": ["in/out rules grounded in the buying signals"],
  "searchQuery": "role + niche (REQUIRED)",
  "jobTitles": ["optional exact titles"],
  "locations": ["optional locations"],
  "seniority": ["entry|senior|manager|director|vp|cxo|owner|partner|founder"],
  "functions": ["sales|marketing|engineering|finance|operations|hr|it|product|consulting|..."],
  "companySize": ["1-10|11-50|51-200|201-500|501-1000|1001-5000|5001-10000|10001+"],
  "count": 25,
  "findEmails": false,
  "enrich": false,
  "grounding": ["Doc titles you used"]
}
```

## Notes

- If `APIFY_TOKEN` is not set (and `LEADS_TEST_MODE` is off) the skill returns a plan-only artifact with `configured: false` — surface that honestly ("targeting plan ready, add APIFY_TOKEN to pull prospects") instead of inventing people.
- Never fabricate prospects. The rows come from the real scrape or not at all.
