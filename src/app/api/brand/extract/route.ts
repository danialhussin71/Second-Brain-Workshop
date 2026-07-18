import { NextResponse } from "next/server";
import { getBrandKit, loadBrandReferenceImages, saveBrandKit, type BrandColor } from "@/lib/brand-kit";
import { openAIJson } from "@/lib/openai-responses";
import { listOwnerNotes } from "@/lib/owner-knowledge";

export const runtime = "nodejs";
export const maxDuration = 300;

type Extraction = {
  colors: BrandColor[];
  headlineFont: string;
  bodyFont: string;
  voice: string;
  vocabulary: string;
  avoid: string;
  styleSpec: string;
};

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["colors", "headlineFont", "bodyFont", "voice", "vocabulary", "avoid", "styleSpec"],
  properties: {
    colors: {
      type: "array", minItems: 5, maxItems: 5,
      items: {
        type: "object", additionalProperties: false, required: ["id", "name", "hex"],
        properties: { id: { type: "string" }, name: { type: "string" }, hex: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" } },
      },
    },
    headlineFont: { type: "string" },
    bodyFont: { type: "string" },
    voice: { type: "string" },
    vocabulary: { type: "string" },
    avoid: { type: "string" },
    styleSpec: {
      type: "string",
      description:
        "The reusable visual system: palette, typography, layout grammar, imagery treatment, spacing, contrast. Form only. Never any literal copy, topic, date, time, price, URL or event detail from the references.",
    },
  },
} as const;

/**
 * The founder's own writing, not the borrowed references, is the honest source
 * for voice. Best-effort: an unreachable brain must never block a style extract.
 */
async function loadBrainVoiceSample(): Promise<string> {
  try {
    const notes = await listOwnerNotes();
    if (!notes.length) return "";
    return notes
      .slice(0, 20)
      .map((note) => `## ${note.title}\n${note.body.trim().slice(0, 2000)}`)
      .join("\n\n")
      .slice(0, 40000);
  } catch {
    return "";
  }
}

export async function POST() {
  try {
    const references = (await loadBrandReferenceImages()).filter((item) => item.role === "style-reference");
    if (!references.length) return NextResponse.json({ error: "Upload at least one style reference first." }, { status: 400 });
    const current = await getBrandKit();
    const brainSample = await loadBrainVoiceSample();
    const content: Array<Record<string, string>> = [
      { type: "input_text", text: "Reverse-engineer a production-ready visual brand system from these references. Identify exact dominant colours, typography character, layout grammar, imagery treatment, spacing, contrast, and rules needed to keep a generated carousel coherent. Do not identify an exact copyrighted font unless unmistakable; describe a close usable category.\n\nDESCRIBE FORM, NEVER SUBJECT MATTER. These references are borrowed purely for their look. Whatever they happen to be about is somebody else's message and must not survive into the spec. Describe the shape, size, position and treatment of what you see; never what it says or depicts. Write \"a short all-caps label sits top-left at 60% opacity\", never \"the label reads JOIN US\". Write \"a rounded pill button in the accent colour, bottom-centre\", never \"a Register button linking to Zoom\".\n\nThe styleSpec must contain NO literal copy from the references: no headlines, taglines, slogans, body sentences, button labels, dates, times, prices, URLs, links, handles, addresses, phone numbers, hashtags, event details, product names, company names, or person names. It must not describe the topic, occasion, campaign or offer the references are for. A reader of your styleSpec should be able to tell exactly how the brand looks and be unable to guess what the references were about.\n\nVoice fields describe TONE ONLY — the register, rhythm and diction of the writing, never its subject. Preserve the existing voice when the references do not establish it." },
      ...references.map((image) => ({ type: "input_image", image_url: `data:${image.type};base64,${Buffer.from(image.data).toString("base64")}` })),
    ];
    if (brainSample) {
      content.push({
        type: "input_text",
        text: `THE FOUNDER'S OWN WRITING — the source of truth for voice, vocabulary and avoid.\n\nThe images above are borrowed and settle look only. The excerpts below are the founder's actual notes and posts, so the voice fields must be reverse-engineered from THEM: the register, sentence rhythm, diction, recurring turns of phrase, and the habits they clearly steer clear of. Where the two disagree about tone, the writing wins. Extract language patterns only — never a topic, claim, client, number or anecdote from these notes, and never any literal sentence.\n\n${brainSample}`,
      });
    }
    const extracted = await openAIJson<Extraction>({
      name: "brand_reference_extraction",
      schema: EXTRACTION_SCHEMA,
      maxOutputTokens: 8000,
      instructions: "You are a senior brand identity director. Produce precise, reusable rules, not aesthetic adjectives alone. The styleSpec must be detailed enough to drive GPT Image 2 consistently across a full carousel. You are reading these references for their visual system only — describe how they look, never what they say or what they are about. When excerpts of the founder's own writing are supplied, the voice, vocabulary and avoid fields must be derived from that writing rather than from the references.",
      input: [{ role: "user", content }],
    });
    // A reference can reveal supporting colours, but it must never silently
    // replace the accent the user explicitly chose in the Brand Studio.
    const primary = current.colors[0];
    const supporting = extracted.colors.filter((color) => color.hex.toUpperCase() !== primary.hex.toUpperCase()).slice(0, 4);
    const kit = await saveBrandKit({ ...current, ...extracted, colors: [primary, ...supporting], updatedAt: new Date().toISOString() });
    return NextResponse.json({ ok: true, analyzed: references.length, kit });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not analyze references." }, { status: 500 });
  }
}
