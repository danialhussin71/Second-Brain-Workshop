# Bundled content playbooks

This directory contains the complete marketing content library imported from the
original Second Brain repository.

- `content-guides.json` contains all 17 production guides previously served by
  the Supabase `content_guides` table.
- `content-guidelines-source.md` is the original consolidated source document.
- `video-script-guides.json` contains the deployment-ready reel and long-form
  video systems distilled from the founder-supplied `reels+longform.md` master
  pack. They are routed directly to their matching producers and include
  duration math, retention structure, production direction, and silent quality
  gates.

Jarvis loads these files at build time through `src/lib/content-guides.ts`.
Selection is deterministic for known deliverables and variants (carousel,
listicle, versus, do/don't, text, newsletter, reel, long-form video, strategy,
and profile), with a
lexical fallback for less common requests. This keeps production self-contained:
there is no Supabase or remote vector-index dependency for the playbooks.

Vercel Blob remains responsible only for the user's uploaded second brain and
brand documents. A Blob object can hold precomputed vectors, but Blob does not
provide nearest-neighbor indexing or semantic query execution; the small,
well-defined playbook library is therefore routed directly in code.
