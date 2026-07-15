import { NextResponse } from "next/server";
import { blobConfigured, upsertOwnerNotes } from "@/lib/owner-knowledge";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!blobConfigured()) return NextResponse.json({ error: "Connect Vercel Blob before saving documents." }, { status: 503 });
    const { title, body, folder = "Documents" } = await request.json() as { title?: string; body?: string; folder?: string };
    if (!title?.trim() || !body?.trim()) return NextResponse.json({ error: "Give the document a title and content." }, { status: 400 });
    const slug = title.trim().replace(/[\\/:*?"<>|]/g, "-");
    const result = await upsertOwnerNotes([{ filename: `${folder.replace(/^\/+|\/+$/g, "")}/${slug}.md`, raw: `---\ntitle: ${JSON.stringify(title.trim())}\n---\n\n${body.trim()}\n` }]);
    return NextResponse.json({ ok: true, documents: result.documents });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save document." }, { status: 500 }); }
}
