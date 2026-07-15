import { NextResponse } from "next/server";
import { normalizeCarouselQuality } from "@/lib/carousel-settings";
import { generateImage, imageModelConfigured } from "@/lib/openai-image";
import { brandKitContext, getBrandKit, loadBrandReferenceImages } from "@/lib/brand-kit";
import { ASPECT_SIZE, buildPostImagePrompt, isStyleKey, type PostAspect } from "@/lib/post-image";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * POST /api/post/image
 * Renders a single-image ("picture") post via gpt-image-2, using the brand kit
 * for identity (founder face), logo, and style references. Kept separate from
 * the streaming run so the image can be (re)generated on demand from the client.
 */
export async function POST(request: Request) {
  if (!imageModelConfigured()) return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });
  const payload = await request.json().catch(() => null) as null | {
    concept?: string;
    image_prompt?: string;
    style?: string;
    aspect?: string;
    on_image_text?: string;
    quality?: string;
  };
  if (!payload || (!payload.concept && !payload.image_prompt)) {
    return NextResponse.json({ error: "Missing image concept." }, { status: 400 });
  }

  const aspect: PostAspect = payload.aspect === "portrait" || payload.aspect === "landscape" ? payload.aspect : "square";
  const quality = normalizeCarouselQuality(payload.quality);

  try {
    const brand = await getBrandKit();
    const references = await loadBrandReferenceImages();
    const hasFace = references.some((reference) => reference.role === "founder-face");

    // Prefer a model-authored prompt, but always fold in the brand kit + identity
    // lock so the founder's real face and palette carry through.
    const prompt = buildPostImagePrompt({
      concept: payload.image_prompt?.trim() || payload.concept!.trim(),
      styleKey: payload.style && isStyleKey(payload.style) ? payload.style : null,
      aspect,
      onImageText: payload.on_image_text,
      brandContext: brandKitContext(brand),
      hasFace,
      referenceRoles: references.map((reference, index) => `reference ${index + 1} = ${reference.role}`),
    });

    const image = await generateImage(prompt, {
      quality,
      size: ASPECT_SIZE[aspect],
      references: references.map(({ data, name, type }) => ({ data, name, type })),
    });
    if (!image) return NextResponse.json({ error: "GPT Image 2 returned no image." }, { status: 502 });
    return NextResponse.json({ image, quality, aspect, model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2", references: references.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Image generation failed." }, { status: 502 });
  }
}
