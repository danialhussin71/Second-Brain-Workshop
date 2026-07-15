import { NextResponse } from "next/server";
import { blobConfigured } from "@/lib/blob-store";
import { getBrandKit, saveBrandKit } from "@/lib/brand-kit";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  try {
    return NextResponse.json({ connected: blobConfigured(), kit: await getBrandKit() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load brand kit." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { kit?: unknown } | null;
    if (!body?.kit) return NextResponse.json({ error: "Brand kit required." }, { status: 400 });
    return NextResponse.json({ ok: true, kit: await saveBrandKit(body.kit) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save brand kit." }, { status: 500 });
  }
}
