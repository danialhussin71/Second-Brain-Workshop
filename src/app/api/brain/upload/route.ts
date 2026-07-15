import { NextResponse } from "next/server";
import path from "node:path";
import { unzipBuffer } from "@/lib/unzip";
import {
  saveOwnerNotes,
  blobConfigured,
} from "@/lib/owner-knowledge";

export const runtime = "nodejs";
export const maxDuration = 300;

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
        for (const e of entries) {
          if (!/\.(md|markdown|txt)$/i.test(e.path)) continue;
          if (e.path.includes("__MACOSX") || e.path.split("/").some((p) => p.startsWith("."))) continue;
          const rel = folderPrefix ? `${folderPrefix}/${e.path}` : e.path;
          notes.push(parseNote(rel, e.data.toString("utf8")));
        }
      } else if (/\.(md|markdown|txt)$/i.test(lower)) {
        const rel = folderPrefix ? `${folderPrefix}/${name}` : name;
        notes.push(parseNote(rel, buf.toString("utf8")));
      }
    }

    if (!notes.length) {
      return NextResponse.json(
        { ok: false, error: "No markdown notes found. Send .md files or a .zip of them." },
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
  const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() || path.basename(filePath).replace(/\.(md|markdown|txt)$/i, "");
  return { path: filePath, title, body };
}
