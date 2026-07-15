import { NextResponse } from "next/server";
import { getBrainStatus } from "@/lib/jarvis-brain";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  try {
    return NextResponse.json(await getBrainStatus());
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
