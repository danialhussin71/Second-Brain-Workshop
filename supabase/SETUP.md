# Supabase setup (OPTIONAL)

Skip this if you only want AI Brain chat. The app answers from
`content/knowledge/*` with just an LLM key — no database required.

Use Supabase only when you want **vault upload** (custom markdown / Obsidian zip)
or brand kits.

## Required SQL for vault upload + search

Paste the full contents of:

- `supabase/migrations/0007_vault_vectors.sql`

That creates:

- `vault_documents` / `vault_chunks`
- `match_vault_chunks()` (semantic search)
- `vault_stats()`

Also enable the **vector** extension (Database → Extensions → `vector`) if the migration does not.

## Optional for brand kit settings

- `supabase/migrations/0009_brand_kits.sql`
- Create a public Storage bucket named `branding` if you upload face/logo assets.

## Env keys to copy

Project Settings → API:

- `NEXT_PUBLIC_SUPABASE_URL` = Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `anon` `public`
- `SUPABASE_SERVICE_ROLE_KEY` = `service_role` (server only — never expose in the browser)

Then seed or upload notes via the gear → **Vault upload** in the app.
