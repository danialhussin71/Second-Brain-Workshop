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
 *
 * Only note files are ever decompressed. Vault exports routinely carry images,
 * PDFs, and attachments; those are discarded unread, so they can neither blow
 * up memory nor fail the upload with a compression method we can't inflate.
 * Client-safe: the browser uses `slimVaultZip` to drop them before uploading.
 */
import { unzipSync, zipSync } from "fflate";

export type ZipEntry = { path: string; data: Buffer };

// Text formats we ingest as knowledge notes. Kept broad on purpose: an
// exported vault often mixes markdown with plain notes and CSV context files.
export const TEXT_FILE = /\.(md|markdown|mdx|txt|text|csv)$/i;

/** Skip macOS resource forks, dotfiles, and dot-folders like .obsidian. */
export function isJunk(entryPath: string): boolean {
  return entryPath.includes("__MACOSX") || entryPath.split("/").some((seg) => seg.startsWith("."));
}

/** A zip entry worth reading: a note file, not a directory or junk. */
export function isNoteEntry(entryPath: string): boolean {
  const p = entryPath.replace(/\\/g, "/");
  return !p.endsWith("/") && TEXT_FILE.test(p) && !isJunk(p);
}

export async function unzipBuffer(buf: Buffer): Promise<ZipEntry[]> {
  const files = unzipSync(new Uint8Array(buf), { filter: (file) => isNoteEntry(file.name) });
  return Object.entries(files).map(([name, bytes]) => ({ path: name.replace(/\\/g, "/"), data: Buffer.from(bytes) }));
}

/** Rebuild a zip holding only its note files, so attachments never leave the browser. */
export function slimVaultZip(bytes: Uint8Array): { zip: Uint8Array; kept: number; dropped: number } {
  let dropped = 0;
  const files = unzipSync(bytes, {
    filter: (file) => {
      if (file.name.endsWith("/")) return false;
      const keep = isNoteEntry(file.name);
      if (!keep) dropped++;
      return keep;
    },
  });
  return { zip: zipSync(files), kept: Object.keys(files).length, dropped };
}
