import { NextResponse } from "next/server";
import { blobConfigured, blobDel, blobGetBytes, blobPutBytes } from "@/lib/blob-store";
import { BRAND_HEADER_PATH } from "@/lib/brand-kit";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_BYTES = 4 * 1024 * 1024;

export async function GET() {
  const result = await blobGetBytes(BRAND_HEADER_PATH);
  if (!result) return new NextResponse(null, { status: 404 });
  return new NextResponse(result.data as BodyInit, {
    headers: { "content-type": result.contentType || "image/png", "cache-control": "no-store, max-age=0" },
  });
}

export async function POST(request: Request) {
  try {
    if (!blobConfigured()) return NextResponse.json({ error: "Connect Vercel Blob before saving a brand header." }, { status: 503 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Header image required." }, { status: 400 });
    if (file.type !== "image/png") return NextResponse.json({ error: "Header must be a PNG." }, { status: 415 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Header image is larger than 4 MB." }, { status: 413 });
    await blobPutBytes(BRAND_HEADER_PATH, new Uint8Array(await file.arrayBuffer()), "image/png");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save header." }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    if (blobConfigured()) await blobDel(BRAND_HEADER_PATH);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not remove header." }, { status: 500 });
  }
}
