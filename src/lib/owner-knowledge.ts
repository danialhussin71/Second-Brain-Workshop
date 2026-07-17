/**
 * Owner second brain = ONE document (BRAIN.md).
 *
 * Vercel Blob stores it at owner/BRAIN.md.
 *
 * Uploads are not kept as separate files. Each note becomes a named section.
 */
import matter from "gray-matter";
import { blobConfigured, blobGetText, blobPutText } from "./blob-store";

export const BRAIN_FILENAME = "BRAIN.md";
/** Stable Blob pathname — overwritten on each upload. */
export const BRAIN_BLOB_PATH = "owner/BRAIN.md";


export type OwnerNote = {
  path: string;
  title: string;
  body: string;
  folder: string;
};

export type OwnerBackend = "blob" | "none";

export { blobConfigured };

export function ownerUploadBackend(): OwnerBackend {
  return blobConfigured() ? "blob" : "none";
}

/**
 * The one path normalisation every write goes through. Merges compare incoming
 * filenames against stored paths, so both sides must normalise identically or a
 * re-upload of the same note lands as a duplicate section.
 */
export function normalizeNotePath(filename: string): string {
  return filename.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\.markdown$/i, ".md");
}

/** Build the single brain document from uploaded notes. */
export function buildBrainMarkdown(
  notes: Array<{ filename: string; title?: string; body: string }>
): string {
  const parts = [
    "# Second Brain",
    "",
    "_This is the default AI brain file. Uploaded notes are merged here as sections — not stored as separate files._",
    "",
  ];
  for (const n of notes) {
    const name = normalizeNotePath(n.filename);
    const title = (n.title || name.replace(/\.md$/i, "")).trim();
    const body = stripFrontmatter(n.body).trim();
    parts.push(`<!-- section: ${name} -->`);
    parts.push(`## ${title}`);
    parts.push("");
    parts.push(`_Source: ${name}_`);
    parts.push("");
    parts.push(body || "_(empty)_");
    parts.push("");
  }
  return parts.join("\n").trimEnd() + "\n";
}

/** Split BRAIN.md back into virtual notes (for UI / light search). */
export function parseBrainMarkdown(raw: string): OwnerNote[] {
  const text = raw.trim();
  if (!text || text === "# Second Brain") return [];

  const sectionRe =
    /<!--\s*section:\s*(.+?)\s*-->\s*\n##\s+(.+?)\n([\s\S]*?)(?=(?:\n<!--\s*section:)|\s*$)/g;
  const out: OwnerNote[] = [];
  let m: RegExpExecArray | null;
  while ((m = sectionRe.exec(text)) !== null) {
    const file = m[1].trim();
    const title = m[2].trim();
    let body = m[3].trim();
    body = body.replace(/^_Source:\s*.+?_\s*/i, "").trim();
    out.push({ path: file, title, body, folder: "owner" });
  }

  if (out.length) return out;

  const { content } = matter(text);
  const body = content.trim();
  if (!body || body.startsWith("_This is the default")) return [];
  return [{ path: BRAIN_FILENAME, title: "Second Brain", body, folder: "owner" }];
}

function stripFrontmatter(raw: string): string {
  const { content } = matter(raw);
  return content;
}

async function readBrainFromBlob(): Promise<string | null> {
  if (!blobConfigured()) return null;
  const text = await blobGetText(BRAIN_BLOB_PATH);
  return text?.trim() ? text : null;
}

async function writeBrainToBlob(markdown: string): Promise<void> {
  await blobPutText(BRAIN_BLOB_PATH, markdown, "text/markdown; charset=utf-8");
}

export async function readOwnerBrainMarkdown(): Promise<string | null> {
  // Blob first when token exists — never let a leftover local .md override the cloud brain.
  if (blobConfigured()) {
    const fromBlob = await readBrainFromBlob();
    if (fromBlob && parseBrainMarkdown(fromBlob).length) return fromBlob;
    return null;
  }

  return null;
}

export async function hasOwnerKnowledge(): Promise<boolean> {
  return !!(await readOwnerBrainMarkdown());
}

export async function listOwnerNotes(): Promise<OwnerNote[]> {
  const raw = await readOwnerBrainMarkdown();
  if (!raw) return [];
  return parseBrainMarkdown(raw);
}

/**
 * Replace BRAIN.md with a fresh merge of the uploaded notes.
 * Uploaded files themselves are not kept.
 */
export async function saveOwnerNotes(
  notes: Array<{ filename: string; raw: string }>
): Promise<{ documents: number; backend: OwnerBackend; path: string }> {
  const backend = ownerUploadBackend();
  if (backend === "none") {
    throw new Error(
      "No Vercel Blob store is connected to this deployment."
    );
  }

  const sections = notes.map((n) => {
    const { data, content } = matter(n.raw);
    const filename = normalizeNotePath(n.filename);
    const title =
      (typeof data.title === "string" && data.title) || filename.replace(/\.md$/i, "");
    return { filename, title, body: content.trim() };
  });

  const markdown = buildBrainMarkdown(sections);

  await writeBrainToBlob(markdown);
  return {
    documents: sections.length,
    backend: "blob",
    path: BRAIN_BLOB_PATH,
  };
}

/** Round-trip a parsed note back into the upload shape saveOwnerNotes expects. */
function toUpload(note: OwnerNote) {
  return { filename: note.path, raw: `---\ntitle: ${JSON.stringify(note.title)}\n---\n\n${note.body}\n` };
}

/** Rewrite BRAIN.md from `notes`, carrying over each existing note `retain` approves. */
async function mergeOwnerNotes(
  notes: Array<{ filename: string; raw: string }>,
  retain: (note: OwnerNote) => boolean
) {
  const existing = await listOwnerNotes();
  const incoming = new Set(notes.map((note) => normalizeNotePath(note.filename)));
  const retained = existing.filter((note) => !incoming.has(note.path) && retain(note)).map(toUpload);
  return saveOwnerNotes([...retained, ...notes]);
}

/** Add or replace named notes while preserving every existing virtual vault path. */
export function upsertOwnerNotes(notes: Array<{ filename: string; raw: string }>) {
  return mergeOwnerNotes(notes, () => true);
}

/**
 * Replace the vault wholesale — a re-upload should drop notes deleted since the
 * last one — but keep hand-written notes under `folders`, which no vault export
 * contains and which a blind replace would silently destroy.
 */
export function replaceOwnerNotesKeeping(
  notes: Array<{ filename: string; raw: string }>,
  folders: string[]
) {
  return mergeOwnerNotes(notes, (note) => folders.some((folder) => note.path.startsWith(`${folder}/`)));
}
