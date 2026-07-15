/**
 * Single-image ("picture") post art direction, adapted from FounderOS's content
 * image system. Style presets use concrete lens/lighting language (Flux/ComfyUI
 * best practice) rather than vague adjectives that rewrite faces, plus an
 * identity lock so the founder's real face carries through from the brand kit.
 */

export type PostAspect = "square" | "portrait" | "landscape";

/** Sizes the gpt-image-2 endpoint accepts, mapped from a friendly aspect. */
export const ASPECT_SIZE: Record<PostAspect, "1024x1024" | "1024x1536" | "1536x1024"> = {
  square: "1024x1024",
  portrait: "1024x1536",
  landscape: "1536x1024",
};

export const ASPECT_HINT: Record<PostAspect, string> = {
  square: "1:1 · Instagram / LinkedIn feed",
  portrait: "4:5 · Instagram portrait",
  landscape: "1.91:1 · LinkedIn / Facebook link",
};

export const STYLE_PRESETS = {
  hyper_realistic: {
    label: "Hyper-realistic",
    hint: "Maximum realism for founder authority posts",
    prompt:
      "Hyper-realistic professional photograph. Full-frame mirrorless camera, 85mm f/1.4 lens at ISO 200. Natural directional key light with soft fill and realistic shadow falloff. Visible skin texture and pores, candid but confident expression, shallow depth of field with organic bokeh. A real photograph, not a render.",
  },
  editorial: {
    label: "Editorial",
    hint: "Magazine-style thought leadership",
    prompt:
      "High-end editorial magazine photograph. Considered art direction, refined styling, sophisticated muted palette with one accent hue. 50mm lens at f/2.8, soft diffused light like an overcast day through large windows. Magazine-cover composition with generous negative space.",
  },
  cinematic: {
    label: "Cinematic",
    hint: "Story-driven, film-still mood",
    prompt:
      "Cinematic film still. Anamorphic lens character, shallow depth of field, moody motivated lighting with practical sources in frame. Filmic grade with gentle teal-and-amber separation and subtle film grain. A frame from a real film, not digital illustration.",
  },
  lifestyle_candid: {
    label: "Lifestyle candid",
    hint: "Behind-the-scenes, relatable energy",
    prompt:
      "Authentic lifestyle candid photograph. Natural ambient light in a real environment with believable depth and lived-in detail. Documentary feel, 35mm lens at f/2.0, caught-in-the-moment energy rather than a posed studio shot. Warm, approachable, human.",
  },
  brand_graphic: {
    label: "Brand graphic",
    hint: "Bold design-forward announcements",
    prompt:
      "Bold brand-forward social graphic with photographic depth, not flat clipart. Rich gradient or textured background with subtle dimensional lighting, geometric accent shapes, and strong color blocking. Premium design-studio aesthetic. Leave clean space for an optional headline.",
  },
} as const;

export type StyleKey = keyof typeof STYLE_PRESETS;

export function isStyleKey(v: string): v is StyleKey {
  return v in STYLE_PRESETS;
}

/** Resolve a style by key, or fuzzily by the label the model returned. */
export function resolveStyle(value?: string | null): { key: StyleKey; prompt: string; label: string } {
  const raw = (value || "").trim().toLowerCase();
  const key = (Object.keys(STYLE_PRESETS) as StyleKey[]).find(
    (k) => k === raw || STYLE_PRESETS[k].label.toLowerCase() === raw,
  ) ?? "editorial";
  return { key, ...STYLE_PRESETS[key] };
}

const PLATFORM_COMPOSITION: Record<PostAspect, string> = {
  portrait:
    "Vertical portrait composition for a mobile feed. Subject fills the frame confidently; keep key elements away from the extreme top and bottom edges.",
  square:
    "Square composition. Centered, balanced framing with breathing room around the subject.",
  landscape:
    "Wide landscape composition for a professional feed. Clean and uncluttered; reads clearly even at thumbnail size.",
};

const PHOTOREALISM =
  "Photographic realism is non-negotiable: true-to-life skin with visible texture and pores, natural imperfections, accurate anatomy and hands, physically plausible lighting and reflections, realistic material texture, true-to-life color grading.";

const NEGATIVE_GUARDRAILS =
  "Avoid: uncanny valley faces, waxy or plastic skin, over-smoothed beauty-filter skin, AI gloss or HDR halos, distorted anatomy or hands, extra fingers, cut-out paste-job compositing, floating subjects with mismatched shadows, unwanted baked-in text/letters/logos/watermarks, borders or UI chrome, generic stock-photo smiles, cartoon or illustration style unless requested, duplicated or melted facial features.";

const IDENTITY_LOCK =
  "The person shown in the supplied founder-face reference is the subject. Preserve their exact facial identity: bone structure, eye shape, nose, mouth, skin tone, hair, and build. No beautification, no age or ethnicity change, no averaging toward a generic face. Integrate them with physically matching lighting, shadow falloff, perspective, and color temperature so they are never a floating cut-out. This must clearly be the same real person.";

export function buildPostImagePrompt(args: {
  concept: string;
  styleKey?: StyleKey | null;
  aspect: PostAspect;
  onImageText?: string;
  brandContext?: string;
  hasFace?: boolean;
  referenceRoles?: string[];
}): string {
  const style = resolveStyle(args.styleKey);
  const parts: string[] = [style.prompt];

  if (args.hasFace) parts.push(IDENTITY_LOCK);
  parts.push(`Scene: ${args.concept.trim()}`);
  parts.push(PLATFORM_COMPOSITION[args.aspect]);

  if (args.onImageText?.trim()) {
    parts.push(
      `Render this exact text inside the image, cleanly and legibly, integrated into the composition (not a watermark): "${args.onImageText.trim()}". Do not add any other words.`,
    );
  } else {
    parts.push("Do not render any text, letters, numbers, logos, or watermarks in the image.");
  }

  if (args.brandContext?.trim()) {
    parts.push(`AUTHORITATIVE BRAND KIT — weave its palette, typography character, and mood into the image naturally:\n${args.brandContext.trim()}`);
  }
  if (args.referenceRoles?.length) {
    parts.push(`Reference image legend, in upload order: ${args.referenceRoles.join("; ")}. Use style references for palette and treatment; reproduce any real logo accurately; never copy another brand's old copy.`);
  }

  parts.push(PHOTOREALISM);
  parts.push(NEGATIVE_GUARDRAILS);
  return parts.join("\n\n");
}
