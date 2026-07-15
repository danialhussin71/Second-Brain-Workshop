import { NextResponse } from "next/server";
import { readBrandAsset, removeBrandAsset, saveBrandAsset, type BrandAsset } from "@/lib/brand-kit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 12 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const validKind = (value: string): value is BrandAsset["kind"] => ["face", "logo", "reference"].includes(value);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") || "";
  if (!validKind(kind)) return NextResponse.json({ error: "kind must be face, logo, or reference." }, { status: 400 });
  const result = await readBrandAsset(kind, url.searchParams.get("id") || undefined);
  if (!result) return new NextResponse(null, { status: 404 });
  return new NextResponse(result.data as BodyInit, {
    headers: {
      "content-type": result.contentType,
      "content-disposition": `inline; filename=${JSON.stringify(result.asset.name)}`,
      "cache-control": "private, max-age=300",
    },
  });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const kind = String(form.get("kind") || "");
    const file = form.get("file");
    if (!validKind(kind)) return NextResponse.json({ error: "kind must be face, logo, or reference." }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "Image file required." }, { status: 400 });
    if (!IMAGE_TYPES.has(file.type)) return NextResponse.json({ error: "Use a PNG, JPG, or WebP image." }, { status: 415 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image is larger than 12 MB." }, { status: 413 });
    return NextResponse.json({ ok: true, kit: await saveBrandAsset(kind, file) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { kind?: string; id?: string } | null;
    if (!body?.kind || !validKind(body.kind)) return NextResponse.json({ error: "Valid asset kind required." }, { status: 400 });
    return NextResponse.json({ ok: true, kit: await removeBrandAsset(body.kind, body.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not remove asset." }, { status: 500 });
  }
}
