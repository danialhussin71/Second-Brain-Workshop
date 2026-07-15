import { NextResponse } from "next/server";
import { getBrandKit, loadBrandReferenceImages, saveBrandKit, type BrandColor } from "@/lib/brand-kit";
import { openAIJson } from "@/lib/openai-responses";

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
    styleSpec: { type: "string" },
  },
} as const;

export async function POST() {
  try {
    const references = (await loadBrandReferenceImages()).filter((item) => item.role === "style-reference");
    if (!references.length) return NextResponse.json({ error: "Upload at least one style reference first." }, { status: 400 });
    const current = await getBrandKit();
    const content: Array<Record<string, string>> = [
      { type: "input_text", text: "Reverse-engineer a production-ready visual brand system from these references. Identify exact dominant colours, typography character, layout grammar, imagery treatment, recurring components, spacing, contrast, and rules needed to keep a generated carousel coherent. Do not identify an exact copyrighted font unless unmistakable; describe a close usable category. Keep voice fields grounded in visible copy only, and preserve the existing voice when the references do not establish it." },
      ...references.map((image) => ({ type: "input_image", image_url: `data:${image.type};base64,${Buffer.from(image.data).toString("base64")}` })),
    ];
    const extracted = await openAIJson<Extraction>({
      name: "brand_reference_extraction",
      schema: EXTRACTION_SCHEMA,
      maxOutputTokens: 8000,
      instructions: "You are a senior brand identity director. Produce precise, reusable rules, not aesthetic adjectives alone. The styleSpec must be detailed enough to drive GPT Image 2 consistently across a full carousel.",
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
