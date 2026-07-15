/**
 * Session memory — every chat writes a small note back into the second brain
 * so Jarvis remembers what it did. These notes live under the `Sessions/`
 * folder and are recalled like any other knowledge, with a boost when the user
 * asks a "remember when you did X" style question.
 */
import { openAIJson } from "./openai-responses";
import {
  blobConfigured,
  listOwnerNotes,
  saveOwnerNotes,
  type OwnerNote,
} from "./owner-knowledge";

export const SESSIONS_FOLDER = "Sessions";
/** Keep the most recent N sessions so the brain does not grow without bound. */
const MAX_SESSIONS = 150;

/** True when the message is asking Jarvis to recall a past session/action. */
export function isRecallQuery(text: string): boolean {
  return /\b(remember(?:\s+when)?|recall|last time|previously|earlier (?:you|we)|what (?:did|have) (?:you|we)|the (?:time|session|chat) (?:when|where)|you (?:did|made|wrote|created|built)|we (?:did|made|wrote|created|built)|back when|history of (?:our|my)|past (?:sessions?|chats?|work))\b/i.test(
    text,
  );
}

/** Is this note a recorded session (vs. uploaded knowledge)? */
export function isSessionNote(note: Pick<OwnerNote, "path">): boolean {
  return note.path.startsWith(`${SESSIONS_FOLDER}/`);
}

const SESSION_SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "recap", "tags"],
  properties: {
    title: { type: "string", description: "A short, specific label for what happened, e.g. '7-slide carousel on cold outreach'." },
    recap: { type: "string", description: "2-4 sentences, past tense, describing what the user asked for and what was produced." },
    tags: { type: "array", items: { type: "string" }, maxItems: 8, description: "Lowercase topic keywords for later recall." },
  },
} as const;

type SessionSummary = { title: string; recap: string; tags: string[] };

export type SessionInput = {
  runId: string;
  at: number;
  instruction: string;
  rationale?: string;
  /** Content formats that were produced this run (e.g. ["carousel"]). */
  producedFormats: string[];
  /** Short per-agent contributions: what each producer delivered. */
  contributions: Array<{ agent: string; title: string; summary: string }>;
  /** Exact source titles the run was grounded in. */
  citations: string[];
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** YYYY-MM-DD for filenames; a friendlier form for the note body. */
function stamps(at: number): { file: string; human: string } {
  const d = new Date(at);
  const file = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const human = d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  return { file, human };
}

async function summarize(input: SessionInput): Promise<SessionSummary> {
  const material = input.contributions
    .map((c) => `- ${c.agent}: ${c.title} — ${c.summary}`)
    .join("\n") || "(no separate producer output)";
  try {
    return await openAIJson<SessionSummary>({
      name: "session_memory",
      schema: SESSION_SUMMARY_SCHEMA,
      maxOutputTokens: 1200,
      instructions:
        "You write a terse memory entry recording what an AI marketing assistant just did for the founder, so it can be recalled later. " +
        "Write the recap in past tense and second person ('You asked me to..., and I...'). Be concrete about the topic and what was produced. Never invent details beyond the material.",
      input: `The founder asked:\n${input.instruction}\n\nRouting rationale: ${input.rationale || "n/a"}\nFormats produced: ${input.producedFormats.join(", ") || "none"}\n\nWhat the team delivered:\n${material}`,
    });
  } catch {
    // Fall back to a deterministic recap if the model call fails — the memory
    // is more valuable than the prose.
    const what = input.producedFormats.length ? `Produced: ${input.producedFormats.join(", ")}.` : "Answered from the second brain.";
    return {
      title: input.instruction.slice(0, 80),
      recap: `You asked: "${input.instruction}". ${what}`,
      tags: [],
    };
  }
}

function buildBody(input: SessionInput, summary: SessionSummary, human: string): string {
  const produced = input.contributions.length
    ? input.contributions.map((c) => `- ${c.title} (${c.agent}): ${c.summary}`).join("\n")
    : "- (knowledge answer, no deliverable)";
  const tagLine = summary.tags.length ? summary.tags.map((t) => t.replace(/^#/, "")).join(", ") : "none";
  return [
    `**When:** ${human}`,
    `**You asked:** ${input.instruction.replace(/\s+/g, " ").trim()}`,
    "",
    `**What I did:** ${summary.recap}`,
    "",
    "**Produced:**",
    produced,
    "",
    `**Topics:** ${tagLine}`,
    input.citations.length ? `**Grounded in:** ${input.citations.join(", ")}` : "",
  ].filter(Boolean).join("\n");
}

const toRaw = (note: OwnerNote) =>
  ({ filename: note.path, raw: `---\ntitle: ${JSON.stringify(note.title)}\n---\n\n${note.body}\n` });

/**
 * Summarize the just-finished run and append it to the brain as a Sessions note,
 * pruning to the most recent MAX_SESSIONS. Returns the note title, or null if
 * memory could not be written (e.g. no Blob store). Never throws.
 */
export async function recordSession(input: SessionInput): Promise<string | null> {
  if (!blobConfigured()) return null;
  if (!input.instruction.trim()) return null;
  try {
    const summary = await summarize(input);
    const { file, human } = stamps(input.at);
    const note: OwnerNote = {
      path: `${SESSIONS_FOLDER}/${file}-${input.runId}.md`,
      title: `Session — ${summary.title}`.slice(0, 120),
      body: buildBody(input, summary, human),
      folder: SESSIONS_FOLDER,
    };

    const existing = await listOwnerNotes();
    const others = existing.filter((n) => !isSessionNote(n));
    const sessions = existing.filter(isSessionNote);
    // Newest first (filenames start with the ISO date), keep the newest window.
    const kept = [note, ...sessions.filter((s) => s.path !== note.path)]
      .sort((a, b) => b.path.localeCompare(a.path))
      .slice(0, MAX_SESSIONS);

    await saveOwnerNotes([...others, ...kept].map(toRaw));
    return note.title;
  } catch {
    return null;
  }
}
