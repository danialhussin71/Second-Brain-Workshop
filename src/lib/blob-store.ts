/**
 * Shared Vercel Blob helpers for durable app data (brain, brand kit, knowledge).
 *
 * Auth (any of these counts as "configured"):
 * - BLOB_READ_WRITE_TOKEN (classic / local via `vercel env pull`)
 * - BLOB_STORE_ID + Vercel OIDC on the host (what Deploy → Storage often injects now)
 *
 * Do NOT pass an empty `token:` into SDK calls — that blocks OIDC auto-auth.
 */

export function blobConfigured(): boolean {
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return true;
  // Store linked to the project (Deploy / Storage). On Vercel the SDK uses OIDC.
  if (process.env.BLOB_STORE_ID?.trim()) return true;
  return false;
}

/** What the runtime thinks is providing Blob auth — useful in /api/brain status. */
export function blobAuthMode(): "rw-token" | "oidc-store" | "none" {
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return "rw-token";
  if (process.env.BLOB_STORE_ID?.trim()) return "oidc-store";
  return "none";
}

/** Options for @vercel/blob — only include token when we actually have one. */
function authOpts(): { token?: string } {
  const t = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return t ? { token: t } : {};
}

export async function blobPutText(
  pathname: string,
  body: string,
  contentType = "text/plain; charset=utf-8"
): Promise<void> {
  const { put } = await import("@vercel/blob");
  await put(pathname, body, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
    ...authOpts(),
  });
}

export async function blobPutBytes(
  pathname: string,
  body: Uint8Array,
  contentType: string
): Promise<void> {
  const { put } = await import("@vercel/blob");
  await put(pathname, Buffer.from(body), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
    ...authOpts(),
  });
}

export async function blobGetText(pathname: string): Promise<string | null> {
  const bytes = await blobGetBytes(pathname);
  if (!bytes) return null;
  return new TextDecoder().decode(bytes.data);
}

export async function blobGetBytes(
  pathname: string
): Promise<{ data: Uint8Array; contentType: string } | null> {
  if (!blobConfigured()) return null;
  const auth = authOpts();
  try {
    const { get } = await import("@vercel/blob");
    // Mutable app records (brain, brand kit) reuse stable paths. Private Blob
    // reads default to CDN cache, so bypass it to guarantee read-after-write.
    const result = await get(pathname, { access: "private", useCache: false, ...auth });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const buf = Buffer.from(await new Response(result.stream).arrayBuffer());
    return {
      data: new Uint8Array(buf),
      contentType: result.blob?.contentType || "application/octet-stream",
    };
  } catch {
    try {
      const { head } = await import("@vercel/blob");
      const info = await head(pathname, auth);
      if (!info?.url) return null;
      const headers: HeadersInit = {};
      if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
      const res = await fetch(info.url, { headers, cache: "no-store" });
      if (!res.ok) return null;
      return {
        data: new Uint8Array(await res.arrayBuffer()),
        contentType: res.headers.get("content-type") || "application/octet-stream",
      };
    } catch {
      return null;
    }
  }
}

export async function blobList(prefix: string): Promise<string[]> {
  if (!blobConfigured()) return [];
  try {
    const { list } = await import("@vercel/blob");
    const result = await list({ prefix, limit: 1000, ...authOpts() });
    return result.blobs.map((b) => b.pathname);
  } catch {
    return [];
  }
}

export async function blobDel(pathname: string): Promise<void> {
  if (!blobConfigured()) return;
  try {
    const { del } = await import("@vercel/blob");
    await del(pathname, authOpts());
  } catch {
    /* ignore */
  }
}
