/**
 * ZIP reader for vault uploads, backed by fflate.
 *
 * The previous hand-rolled reader trusted the compressed size in each local
 * file header. Archives created by macOS Finder ("Compress"), the `zip` CLI,
 * and many other tools stream their entries with a data descriptor: the local
 * header carries size 0 and the real sizes live *after* the compressed bytes.
 * That made the old reader hand empty/truncated data to inflate and throw,
 * so any Mac-made vault zip was rejected. fflate reads the central directory,
 * so it handles data descriptors, deflate, and store transparently.
 */
import { unzipSync } from "fflate";

export type ZipEntry = { path: string; data: Buffer };

export async function unzipBuffer(buf: Buffer): Promise<ZipEntry[]> {
  const files = unzipSync(new Uint8Array(buf));
  const out: ZipEntry[] = [];
  for (const [name, bytes] of Object.entries(files)) {
    if (name.endsWith("/")) continue; // directory entry
    out.push({ path: name.replace(/\\/g, "/"), data: Buffer.from(bytes) });
  }
  return out;
}
