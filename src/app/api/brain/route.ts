import { NextResponse } from "next/server";
import { getBrainStatus } from "@/lib/jarvis-brain";

export const runtime = "nodejs";
export const maxDuration = 30;
// The brain lives on Blob and changes at runtime (uploads). Without this, Vercel
// prerenders this GET at build time — when no brain exists — and the CDN serves
// that empty snapshot forever, so the live graph shows "Vault not synced" even
// after a successful upload. force-dynamic keeps every request fresh.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    return NextResponse.json(await getBrainStatus(), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
