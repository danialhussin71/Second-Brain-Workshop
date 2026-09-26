import type { BrandColor } from "./brand-kit";
import { openAIJson } from "./openai-responses";

export type Extraction = {
  displayName: string;
  handle: string;
  tagline: string;
  website: string;
  colors: Required<BrandColor>[];
  headlineFont: string;
  bodyFont: string;
  typeHierarchy: string;
  positioning: string;
  audience: string;
  personality: string;
  imagery: string;
  dos: string;
  donts: string;
  voice: string;
  vocabulary: string;
  avoid: string;
  styleSpec: string;
};

const text = (description: string) => ({ type: "string", description });

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "displayName", "handle", "tagline", "website", "colors", "headlineFont", "bodyFont", "typeHierarchy",
    "positioning", "audience", "personality", "imagery", "dos", "donts", "voice", "vocabulary", "avoid", "styleSpec",
  ],
  properties: {
    displayName: text("Founder or brand name as it should appear on deliverables. Empty string if the document does not state it."),
    handle: text("Primary social handle without the @. Empty string if not stated."),
    tagline: text("A short one-line promise suitable under the name in a header. Empty string if not stated."),
    website: text("Website URL. Empty string if not stated."),
    colors: {
      type: "array", minItems: 5, maxItems: 8,
      description: "Every palette colour the document defines, primary first, then secondary, accent, dark, light. Use the document's exact hex values.",
      items: {
        type: "object", additionalProperties: false, required: ["id", "name", "hex", "role", "usage"],
        properties: {
          id: text("Short lowercase slug, e.g. primary, secondary, accent, dark, light."),
          name: text("The colour's name from the document."),
          hex: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
          role: text("Primary, Secondary, Accent, Dark or Light."),
          usage: text("Share of the palette and exactly where it is used, plus any hard rule about it. One line."),
        },
      },
    },
    headlineFont: text("Heading font family plus its character, e.g. 'Manrope Bold/ExtraBold: quietly premium, precise geometric sans'."),
    bodyFont: text("Body font family plus its character."),
    typeHierarchy: text("The type scale as short lines: level, font, weight, size, line height. Include weight-count and font-mixing rules."),
    positioning: text("Offer and positioning in two or three sentences: what the brand sells, to whom, and the space it owns."),
    audience: text("The ideal customer in two or three sentences, including what they need to feel from the brand."),
    personality: text("Perception words, then what the brand must look like and the looks and cliches it must never resemble."),
    imagery: text("Short labelled lines for photography, illustration, graphic style, icons (library, style, stroke, colour, preferred icon names), and layout."),
    dos: text("Numbered visual do's, one per line, taken from the document."),
    donts: text("Numbered visual don'ts, one per line, taken from the document."),
    voice: text("Tone and rhythm. From the founder's own writing when supplied, otherwise from the document's personality. Tone only, never subject."),
    vocabulary: text("Language patterns and phrases to use more of. Tone only."),
    avoid: text("Language, cliches and claims to avoid."),
    styleSpec: text(
      "The locked production visual system that drives an image model across a full carousel: canvas and backgrounds by format, colour proportions and which colour does what, typography hierarchy in use, layout grammar, recurring components, charts and icon treatment, imagery, spacing, contrast pairings, and consistency rules. Form only. No banner copy, bios, CTA wording or other literal marketing text.",
    ),
  },
} as const;

/**
 * Turn a founder's visual identity document into brand kit fields. When
 * excerpts of their own writing are supplied, voice comes from those instead.
 */
export async function extractBrandIdentity(markdown: string, brainSample: string): Promise<Extraction> {
  const content: Array<Record<string, string>> = [
    {
      type: "input_text",
      text: `THE FOUNDER'S VISUAL IDENTITY DOCUMENT. This is their own approved brand strategy and is authoritative: use its exact hex values, font names, sizes and rules rather than inventing or approximating. Fill every field from it. Where a field is not covered, derive it faithfully from what the document does say; for name, handle, tagline and website return an empty string rather than guess.\n\n${markdown.slice(0, 120000)}`,
    },
  ];
  if (brainSample) {
    content.push({
      type: "input_text",
      text: `THE FOUNDER'S OWN WRITING — the source of truth for voice, vocabulary and avoid.\n\nReverse-engineer the voice fields from these notes: register, sentence rhythm, diction, recurring turns of phrase, and habits they steer clear of. Keep them consistent with the identity document's personality. Extract language patterns only — never a topic, claim, client, number or anecdote, and never any literal sentence.\n\n${brainSample}`,
    });
  }
  return openAIJson<Extraction>({
    name: "brand_identity_extraction",
    schema: EXTRACTION_SCHEMA,
    maxOutputTokens: 12000,
    instructions: "You are a senior brand identity director turning a founder's visual identity strategy into a machine-usable brand system. Produce precise, reusable rules, not adjectives alone. The styleSpec must be detailed enough to drive GPT Image 2 consistently across a full carousel, social graphics and slides. Never put banner copy, bios, calls to action or other literal marketing text into the styleSpec.",
    input: [{ role: "user", content }],
  });
}

