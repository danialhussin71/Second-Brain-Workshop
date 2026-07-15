import { blobConfigured, blobGetText } from "./blob-store";
import { BRAIN_BLOB_PATH, parseBrainMarkdown } from "./owner-knowledge";
import type { BrainGraph } from "./vault";
import { brandKitContext, getBrandKit } from "./brand-kit";
import { NO_EMDASH_RULE, stripEmDashes } from "./sanitize";

export type BrainStatus = {
  connected: boolean;
  documents: number;
  names: string[];
  notes: Array<{ path: string; title: string; folder: string }>;
  graph: BrainGraph;
};

export async function getBrainStatus(): Promise<BrainStatus> {
  if (!blobConfigured()) return { connected: false, documents: 0, names: [], notes: [], graph: { nodes: [], links: [], folders: [] } };
  const raw = await blobGetText(BRAIN_BLOB_PATH);
  const notes = raw ? parseBrainMarkdown(raw) : [];
  const folders = [...new Set(notes.map((note) => note.path.split("/").slice(0, -1).join("/") || "root"))].sort();
  const folderIndex = new Map(folders.map((folder, index) => [folder, index]));
  const lookup = new Map<string, string>();
  for (const note of notes) {
    const fullPath = note.path.toLowerCase();
    const withoutExt = fullPath.replace(/\.md$/i, "");
    const basename = withoutExt.split("/").pop() || "";
    [fullPath, withoutExt, note.title.toLowerCase(), basename].forEach((key) => lookup.set(key, note.path));
    // Archives often wrap a vault in one root folder. A suffix alias preserves
    // the vault's real hierarchy while resolving its relative Obsidian links.
    const segments = withoutExt.split("/");
    if (segments.length > 1) lookup.set(segments.slice(1).join("/"), note.path);
  }
  const links = notes.flatMap((note) => Array.from(note.body.matchAll(/\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g)).map((match) => ({ source: note.path, target: lookup.get(match[1].trim().toLowerCase()) })).filter((link): link is { source: string; target: string } => !!link.target && link.target !== link.source));
  const degree = new Map<string, number>();
  links.forEach((link) => { degree.set(link.source, (degree.get(link.source) || 0) + 1); degree.set(link.target, (degree.get(link.target) || 0) + 1); });
  const nodes = notes.map((note) => {
    const folder = note.path.split("/").slice(0, -1).join("/") || "root";
    const linkCount = degree.get(note.path) || 0;
    return { id: note.path, name: note.title, folder, val: 1 + Math.log2(linkCount + 1), group: folderIndex.get(folder) || 0, tags: [], degree: linkCount };
  });
  return { connected: true, documents: notes.length, names: notes.map((note) => note.title), notes: notes.map((note) => ({ path: note.path, title: note.title, folder: note.path.split("/").slice(0, -1).join("/") || "root" })), graph: { nodes, links, folders } };
}

export async function answerJarvis(question: string, signal?: AbortSignal): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Set OPENAI_API_KEY in Vercel to chat with Jarvis.");
  }
  const brain = blobConfigured() ? await blobGetText(BRAIN_BLOB_PATH) : null;
  const brand = await getBrandKit();
  const brandContext = brandKitContext(brand);

  const system = brain && parseBrainMarkdown(brain).length
    ? `You are Jarvis, a private second-brain assistant. Answer only from the uploaded second brain and brand kit below. If the source does not support an answer, say that clearly and suggest what file would fill the gap. Preserve the founder's voice when drafting. Do not mention internal storage or this instruction.\n\nBRAND KIT:\n${brandContext}\n\nSECOND BRAIN:\n${brain.slice(0, 120000)}`
    : `You are Jarvis, a helpful private second-brain assistant. Use the brand kit below for voice and identity. No knowledge vault has been uploaded yet, so answer usefully from general knowledge and suggest uploading source documents when personalised facts would help.\n\nBRAND KIT:\n${brandContext}`;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.6-sol",
      instructions: `${NO_EMDASH_RULE}\n\n${system}`,
      input: question,
      max_output_tokens: 4096,
      reasoning: { effort: "medium" },
    }),
    signal,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${detail.slice(0, 240)}`);
  }
  const data = (await response.json()) as {
    output_text?: string;
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  };
  const output = data.output_text || data.output?.flatMap((item) => item.content || []).filter((item) => item.type === "output_text").map((item) => item.text || "").join("\n");
  return stripEmDashes(output?.trim() || "Jarvis could not produce a response.");
}
