import { NextResponse } from "next/server";
import { APP_CLIENT } from "@/lib/client";
import { buildVaultGraph, getVaultStats, vaultBackendReady } from "@/lib/vault-supabase";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/brain — graph + vault stats for the idle brain backdrop.
 */
export async function GET() {
  try {
    if (!vaultBackendReady()) {
      return NextResponse.json({
        ok: true,
        client: APP_CLIENT,
        configured: false,
        stats: { documents: 0, chunks: 0, folders: 0 },
        graph: { nodes: [], links: [], folders: [] },
        hint: "Supabase is optional. Chat works from bundled knowledge docs. Add Supabase + run 0007_vault_vectors.sql only for vault upload.",
      });
    }

    const [stats, graph] = await Promise.all([getVaultStats(), buildVaultGraph()]);
    return NextResponse.json({
      ok: true,
      client: APP_CLIENT,
      configured: true,
      stats,
      graph,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
