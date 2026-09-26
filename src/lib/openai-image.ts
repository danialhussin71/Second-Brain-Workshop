import { stripBorrowedContent, stripHeaderDirectives } from "./brand-kit";
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
  const references = options.references?.slice(0, 7) || [];
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
  // Scrub here rather than at the call site: the header ban only holds if
  // NOTHING else in the prompt asks for a header, so no caller may opt out.
  // The art director reads the kit's learned spec, so borrowed content can reach
  // the bible even when the kit itself has been scrubbed — scrub it here too.
  const styleBible = stripHeaderDirectives(stripBorrowedContent(args.styleBible || ""));
  // Ordering follows OpenAI's image prompting guide: scene/layout → subject →
  // details → constraints, in short labelled segments, with the hard exclusions
  // restated last so recency reinforces them.
  return [
    `Create slide ${args.index} of ${args.total} for a premium 4:5 LinkedIn carousel about ${args.topic}.`,
    `This is a ${role} slide.`,
    "NO HEADER STRIP: do not put any identity header, profile row, or top strip on this slide. No avatar or circular portrait, no name, no handle, no tagline, no repost mark, no bar, band or banner across the top. The slide starts directly with its own content — use the full canvas for the headline and visual.",
    args.brandContext ? `AUTHORITATIVE BRAND KIT — follow it exactly:\n${args.brandContext}` : "",
    args.referenceRoles?.length
      ? `REFERENCE IMAGE LEGEND, in upload order: ${args.referenceRoles.join("; ")}. Preserve the founder's facial identity and the real logo.\nA style reference is a SWATCH, NOT A SOURCE. Take from it only palette, typography, hierarchy, spacing and finish — the look. Take NOTHING it says or is about. Its words, headlines, labels, dates, times, prices, links, QR codes, calls to action, offers, event or product details, and depicted subject matter belong to a different message and must not appear on this slide in any form, altered or verbatim. If a style reference is a poster, flyer, ad or announcement, it is here for its craft alone; this slide is about ${args.topic} and nothing else. The only words on this slide are the headline and supporting copy given above. If a style reference has an identity/profile strip along its top (avatar, name, handle, tagline, repost mark), do NOT copy it — that strip is banned here.`
      : "",
    `Render the following text exactly, with no paraphrasing or spelling changes. Headline: "${args.title}". Supporting copy: "${args.body}".`,
    `Art direction for this slide: ${args.art || "editorial visual metaphor with restrained detail"}.`,
    `Locked visual system for the entire deck: ${styleBible || "dark editorial background, crisp modern typography, restrained cyan and violet accents, generous spacing"}.`,
    "Maintain safe margins, strong typographic hierarchy, extremely legible text, and visual continuity with every other slide.",
    role === "cover" || role === "closing"
      ? "If a founder-face reference is attached, use that exact person as a polished photorealistic cutout or portrait. Do not alter identity, age, ethnicity, or facial structure."
      : "Keep the founder's face out of this slide unless the art direction explicitly calls for it. Never use it as a small avatar.",
    "If a brand-logo reference is attached, reproduce it accurately and do not redesign it.",
    "No generic AI watermark. No mockup frame around the slide. Output the finished slide artwork only.",
    // Restated last: the two constraints references push hardest against, in the
    // plain prohibition form that measurably suppresses stray text/marks.
    args.referenceRoles?.length
      ? "FINAL CHECK — the only words rendered anywhere on this slide are the headline and supporting copy quoted above. No date, no time, no price, no link, no QR code, no button label, no registration or event line, no borrowed slogan, no extra sentence. Whatever a style reference happens to show, none of its wording reaches this slide."
      : "",
    "FINAL CHECK — there is NO header strip at the top of this slide: no profile row, no avatar, no circular photo, no name, no handle, no tagline, no repost mark, no top bar, band or banner. Even if every style reference has one, this slide does not.",
  ].filter(Boolean).join("\n\n");
}
