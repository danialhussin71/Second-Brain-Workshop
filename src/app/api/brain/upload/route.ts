import { NextResponse } from "next/server";
import path from "node:path";
import { unzipBuffer } from "@/lib/unzip";
import {
  saveOwnerNotes,
  blobConfigured,
} from "@/lib/owner-knowledge";

export const runtime = "nodejs";
export const maxDuration = 300;

// Text formats we ingest as knowledge notes. Kept broad on purpose: an
// exported vault often mixes markdown with plain notes and CSV context files.
const TEXT_FILE = /\.(md|markdown|mdx|txt|text|csv)$/i;

/** Skip macOS resource forks, dotfiles, and dot-folders like .obsidian. */
function isJunk(entryPath: string): boolean {
  return entryPath.includes("__MACOSX") || entryPath.split("/").some((seg) => seg.startsWith("."));
}

/**
 * Vault zips are usually wrapped in one root folder ("Malik Brain/..."). Strip a
 * shared leading segment so folders read as "Wiki" / "Raw" instead of
 * "Malik Brain/Wiki", which keeps the knowledge graph clean.
 */
function stripCommonRoot(paths: string[]): (p: string) => string {
  const withFolder = paths.filter((p) => p.includes("/"));
  if (withFolder.length < 2) return (p) => p;
  const firstSeg = withFolder[0].split("/")[0];
  const shared = paths.every((p) => !p.includes("/") || p.split("/")[0] === firstSeg);
  return shared ? (p) => (p.startsWith(`${firstSeg}/`) ? p.slice(firstSeg.length + 1) : p) : (p) => p;
}

/**
 * POST /api/brain/upload
 * Vercel Blob is the sole storage backend.
 */
export async function POST(req: Request) {
  try {
    if (!blobConfigured()) {
      return NextResponse.json(
        { ok: false, error: "Connect a Vercel Blob store to this project, then redeploy before uploading." },
        { status: 503 }
      );
    }

    const form = await req.formData();
    const folderPrefix = String(form.get("folder") || "").replace(/\\/g, "/").replace(/^\/|\/$/g, "");
    const files = form.getAll("files").filter((f): f is File => typeof f !== "string" && !!f);
    const single = form.get("file");
    if (single && typeof single !== "string") files.push(single);

    if (!files.length) {
      return NextResponse.json({ ok: false, error: "No files uploaded. Use field `files` or `file`." }, { status: 400 });
    }

    const notes: Array<{ path: string; title: string; body: string }> = [];
    for (const file of files) {
      const name = file.name || "note.md";
      const buf = Buffer.from(await file.arrayBuffer());
      const lower = name.toLowerCase();

      if (lower.endsWith(".zip")) {
        const entries = await unzipBuffer(buf);
        const usable = entries.filter((e) => TEXT_FILE.test(e.path) && !isJunk(e.path));
        const rootless = stripCommonRoot(usable.map((e) => e.path));
        for (const e of usable) {
          const clean = rootless(e.path);
          const rel = folderPrefix ? `${folderPrefix}/${clean}` : clean;
          notes.push(parseNote(rel, e.data.toString("utf8")));
        }
      } else if (TEXT_FILE.test(lower)) {
        const rel = folderPrefix ? `${folderPrefix}/${name}` : name;
        notes.push(parseNote(rel, buf.toString("utf8")));
      }
    }

    if (!notes.length) {
      return NextResponse.json(
        { ok: false, error: "No readable notes found. Upload .md, .markdown, .txt, or .csv files, or a .zip of them (Obsidian vault exports work)." },
        { status: 400 }
      );
    }

    const result = await saveOwnerNotes(notes.map((n) => ({ filename: n.path, raw: `---\ntitle: ${JSON.stringify(n.title)}\n---\n\n${n.body}\n` })));
    return NextResponse.json({
      ok: true,
      mode: "blob",
      uploaded: notes.length,
      replaced: true,
      documents: result.documents,
      path: result.path,
    });
  } catch (err) {
    console.error("[brain/upload]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

function parseNote(filePath: string, raw: string) {
  const body = raw.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "").trim();
  const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() || path.basename(filePath).replace(TEXT_FILE, "");
  return { path: filePath, title, body };
}
