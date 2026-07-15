import type { CarouselImageQuality } from "./carousel-settings";

const GENERATE_ENDPOINT = "https://api.openai.com/v1/images/generations";
const EDIT_ENDPOINT = "https://api.openai.com/v1/images/edits";
export type ImageSize = "1024x1024" | "1024x1536" | "1088x1360" | "1536x1024" | "auto";
export type RefImage = { data: Uint8Array; name: string; type: string };

export function imageModelConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function generateImage(
  prompt: string,
  options: { size?: ImageSize; quality?: CarouselImageQuality; references?: RefImage[] } = {}
): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const references = options.references?.slice(0, 6) || [];
  let response: Response;
  if (references.length) {
    const form = new FormData();
    form.append("model", model);
    form.append("prompt", prompt);
    form.append("size", options.size || "1088x1360");
    form.append("quality", options.quality || "high");
    form.append("n", "1");
    for (const reference of references) {
      form.append("image[]", new Blob([reference.data as unknown as BlobPart], { type: reference.type }), reference.name);
    }
    response = await fetch(EDIT_ENDPOINT, { method: "POST", headers: { authorization: `Bearer ${key}` }, body: form });
  } else {
    response = await fetch(GENERATE_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, prompt, size: options.size || "1088x1360", quality: options.quality || "high", n: 1 }),
    });
  }
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GPT Image 2 failed (${response.status}): ${detail.slice(0, 260)}`);
  }
  const json = await response.json() as { data?: Array<{ b64_json?: string; url?: string }> };
  const image = json.data?.[0];
  if (image?.b64_json) return `data:image/png;base64,${image.b64_json}`;
  return image?.url || null;
}

export function carouselSlidePrompt(args: {
  index: number;
  total: number;
  title: string;
  body: string;
  art: string;
  styleBible: string;
  topic: string;
  brandContext?: string;
  referenceRoles?: string[];
}): string {
  const role = args.index === 1 ? "cover" : args.index === args.total ? "closing" : "body";
  return [
    `Create slide ${args.index} of ${args.total} for a premium 4:5 LinkedIn carousel about ${args.topic}.`,
    `This is a ${role} slide.`,
    args.brandContext ? `AUTHORITATIVE BRAND KIT — follow it exactly:\n${args.brandContext}` : "",
    args.referenceRoles?.length ? `REFERENCE IMAGE LEGEND, in upload order: ${args.referenceRoles.join("; ")}. Preserve the founder's facial identity and the real logo. Use style references for palette, hierarchy, spacing, and recurring components; never copy their old slide copy.` : "",
    `Render the following text exactly, with no paraphrasing or spelling changes. Headline: "${args.title}". Supporting copy: "${args.body}".`,
    `Art direction for this slide: ${args.art || "editorial visual metaphor with restrained detail"}.`,
    `Locked visual system for the entire deck: ${args.styleBible || "dark editorial background, crisp modern typography, restrained cyan and violet accents, generous spacing"}.`,
    "Maintain safe margins, strong typographic hierarchy, extremely legible text, consistent header/footer placement, and visual continuity with every other slide.",
    role === "cover" || role === "closing" ? "If a founder-face reference is attached, use that exact person as a polished photorealistic cutout or portrait. Do not alter identity, age, ethnicity, or facial structure." : "Use the founder-face reference only for the small recurring avatar unless the visual direction explicitly requires the founder.",
    "If a brand-logo reference is attached, reproduce it accurately and do not redesign it.",
    "No generic AI watermark. No mockup frame around the slide. Output the finished slide artwork only.",
  ].filter(Boolean).join("\n\n");
}
