import { NextResponse } from "next/server";
import { normalizeCarouselQuality } from "@/lib/carousel-settings";
import { carouselSlidePrompt, generateImage, imageModelConfigured } from "@/lib/openai-image";
import { brandKitContext, getBrandKit, hasBrandHeader, loadBrandReferenceImages } from "@/lib/brand-kit";

export const runtime = "nodejs";
export const maxDuration = 300;

type SlideRequest = {
  index: number;
  kind?: "hook" | "body" | "cta";
  title: string;
  body: string;
  layout?: "split" | "stacked" | "statement";
  visual?: string;
  logos?: string[];
};

export async function POST(request: Request) {
  if (!imageModelConfigured()) return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });
  const payload = await request.json().catch(() => null) as null | {
    topic?: string;
    total?: number;
    styleBible?: string;
    quality?: string;
    slide?: SlideRequest;
  };
  if (!payload?.slide?.title || typeof payload.slide.index !== "number") {
    return NextResponse.json({ error: "Missing slide data." }, { status: 400 });
  }
  const quality = normalizeCarouselQuality(payload.quality);
  const slide = payload.slide;
  try {
    const brand = await getBrandKit();
    const brandReferences = await loadBrandReferenceImages();
    // When a pre-rendered header exists, the prompt reserves a clean top strip
    // (background flows through it) and the client overlays the header
    // elements after generation.
    const lockedHeader = await hasBrandHeader();
    const image = await generateImage(carouselSlidePrompt({
      index: slide.index + 1,
      total: payload.total || 1,
      title: slide.title,
      body: slide.body,
      art: [slide.visual, slide.layout ? `Layout: ${slide.layout}.` : "", slide.logos?.length ? `Use accurate official marks for: ${slide.logos.join(", ")}.` : ""].filter(Boolean).join(" "),
      styleBible: payload.styleBible || "",
      topic: payload.topic || slide.title,
      brandContext: brandKitContext(brand),
      referenceRoles: brandReferences.map((reference, index) => `reference ${index + 1} = ${reference.role}`),
      lockedHeader,
    }), { quality, size: "1088x1360", references: brandReferences.map(({ data, name, type }) => ({ data, name, type })) });
    if (!image) return NextResponse.json({ error: "GPT Image 2 returned no image." }, { status: 502 });
    return NextResponse.json({ image, quality, model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2", references: brandReferences.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Image generation failed." }, { status: 502 });
  }
}
