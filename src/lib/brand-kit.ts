import { blobConfigured, blobDel, blobGetBytes, blobGetText, blobPutBytes, blobPutText } from "./blob-store";

export const BRAND_KIT_PATH = "owner/brand/kit.json";
const BRAND_ASSET_PREFIX = "owner/brand/assets";
/** The pre-rendered locked carousel header (rendered client-side at kit save). */
export const BRAND_HEADER_PATH = "owner/brand/assets/locked-header.png";

export type BrandColor = {
  id: string;
  name: string;
  hex: string;
};

export type BrandAsset = {
  id: string;
  kind: "face" | "logo" | "reference";
  path: string;
  name: string;
  contentType: string;
  updatedAt: string;
};

export type BrandKit = {
  version: 1;
  displayName: string;
  handle: string;
  tagline: string;
  website: string;
  colors: BrandColor[];
  headlineFont: string;
  bodyFont: string;
  voice: string;
  vocabulary: string;
  avoid: string;
  styleSpec: string;
  notes: string;
  assets: {
    face: BrandAsset | null;
    logo: BrandAsset | null;
    references: BrandAsset[];
  };
  updatedAt: string;
};

export type BrandReferenceImage = {
  data: Uint8Array;
  name: string;
  type: string;
  role: "founder-face" | "brand-logo" | "style-reference";
};

/**
 * A blank starting kit — no baked-in identity. Users add their own name, voice,
 * palette, and style. The neutral placeholder palette only gives the colour UI
 * editable slots (it has no add-colour button); every value is meant to be
 * overwritten.
 */
export const DEFAULT_BRAND_KIT: BrandKit = {
  version: 1,
  displayName: "",
  handle: "",
  tagline: "",
  website: "",
  colors: [
    { id: "primary", name: "Accent", hex: "#5B677A" },
    { id: "ink", name: "Background", hex: "#0B0C10" },
    { id: "surface", name: "Surface", hex: "#161922" },
    { id: "text", name: "Text", hex: "#FFFFFF" },
    { id: "muted", name: "Muted", hex: "#9AA3B2" },
  ],
  headlineFont: "",
  bodyFont: "",
  voice: "",
  vocabulary: "",
  avoid: "",
  styleSpec: "",
  notes: "",
  assets: { face: null, logo: null, references: [] },
  updatedAt: "",
};

const cleanText = (value: unknown, fallback = "", max = 20_000) =>
  typeof value === "string" ? value.trim().slice(0, max) : fallback;

const cleanHex = (value: unknown, fallback: string) => {
  const candidate = cleanText(value).toUpperCase();
  return /^#[0-9A-F]{6}$/.test(candidate) ? candidate : fallback;
};

function normalizeAsset(value: unknown, kind: BrandAsset["kind"]): BrandAsset | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<BrandAsset>;
  if (!raw.path || !raw.id) return null;
  return {
    id: cleanText(raw.id, "", 120),
    kind,
    path: cleanText(raw.path, "", 300),
    name: cleanText(raw.name, `${kind}.png`, 180),
    contentType: cleanText(raw.contentType, "image/png", 80),
    updatedAt: cleanText(raw.updatedAt, new Date().toISOString(), 80),
  };
}

export function normalizeBrandKit(value: unknown, previous: BrandKit = DEFAULT_BRAND_KIT): BrandKit {
  const raw = value && typeof value === "object" ? value as Partial<BrandKit> : {};
  const incomingColors = Array.isArray(raw.colors) ? raw.colors : previous.colors;
  const colors = incomingColors.slice(0, 8).map((color, index) => {
    const fallback = previous.colors[index] || DEFAULT_BRAND_KIT.colors[index % DEFAULT_BRAND_KIT.colors.length];
    return {
      id: cleanText(color?.id, fallback.id, 40) || fallback.id,
      name: cleanText(color?.name, fallback.name, 80) || fallback.name,
      hex: cleanHex(color?.hex, fallback.hex),
    };
  });
  while (colors.length < 5) colors.push({ ...DEFAULT_BRAND_KIT.colors[colors.length] });
  const assets = raw.assets && typeof raw.assets === "object" ? raw.assets : previous.assets;
  const references = Array.isArray(assets.references)
    ? assets.references.map((item) => normalizeAsset(item, "reference")).filter((item): item is BrandAsset => !!item).slice(-4)
    : previous.assets.references;
  return {
    version: 1,
    displayName: cleanText(raw.displayName, previous.displayName, 120),
    handle: cleanText(raw.handle, previous.handle, 120).replace(/^@/, ""),
    tagline: cleanText(raw.tagline, previous.tagline, 240),
    website: cleanText(raw.website, previous.website, 240),
    colors,
    headlineFont: cleanText(raw.headlineFont, previous.headlineFont, 300),
    bodyFont: cleanText(raw.bodyFont, previous.bodyFont, 300),
    voice: cleanText(raw.voice, previous.voice, 8_000),
    vocabulary: cleanText(raw.vocabulary, previous.vocabulary, 8_000),
    avoid: cleanText(raw.avoid, previous.avoid, 8_000),
    styleSpec: cleanText(raw.styleSpec, previous.styleSpec, 20_000),
    notes: cleanText(raw.notes, previous.notes, 8_000),
    assets: {
      face: normalizeAsset(assets.face, "face"),
      logo: normalizeAsset(assets.logo, "logo"),
      references,
    },
    updatedAt: cleanText(raw.updatedAt, previous.updatedAt, 80),
  };
}

export async function getBrandKit(): Promise<BrandKit> {
  if (!blobConfigured()) return DEFAULT_BRAND_KIT;
  const raw = await blobGetText(BRAND_KIT_PATH);
  if (!raw) return DEFAULT_BRAND_KIT;
  try {
    return normalizeBrandKit(JSON.parse(raw));
  } catch {
    return DEFAULT_BRAND_KIT;
  }
}

export async function saveBrandKit(value: unknown): Promise<BrandKit> {
  if (!blobConfigured()) throw new Error("Connect Vercel Blob before saving a brand kit.");
  const current = await getBrandKit();
  const kit = normalizeBrandKit(value, current);
  kit.updatedAt = new Date().toISOString();
  await blobPutText(BRAND_KIT_PATH, JSON.stringify(kit, null, 2), "application/json; charset=utf-8");
  return kit;
}

export async function saveBrandAsset(kind: BrandAsset["kind"], file: File): Promise<BrandKit> {
  if (!blobConfigured()) throw new Error("Connect Vercel Blob before uploading brand assets.");
  const current = await getBrandKit();
  const id = kind === "reference" ? crypto.randomUUID() : kind;
  const path = `${BRAND_ASSET_PREFIX}/${kind}-${id}`;
  const contentType = file.type || "image/png";
  await blobPutBytes(path, new Uint8Array(await file.arrayBuffer()), contentType);
  const asset: BrandAsset = { id, kind, path, name: file.name || `${kind}.png`, contentType, updatedAt: new Date().toISOString() };
  if (kind === "face") current.assets.face = asset;
  else if (kind === "logo") current.assets.logo = asset;
  else {
    current.assets.references = [...current.assets.references, asset].slice(-4);
    const retained = new Set(current.assets.references.map((item) => item.path));
    const stale = (await getBrandKit()).assets.references.filter((item) => !retained.has(item.path));
    await Promise.all(stale.map((item) => blobDel(item.path)));
  }
  return saveBrandKit(current);
}

export async function removeBrandAsset(kind: BrandAsset["kind"], id?: string): Promise<BrandKit> {
  const current = await getBrandKit();
  let asset: BrandAsset | null = null;
  if (kind === "face") { asset = current.assets.face; current.assets.face = null; }
  else if (kind === "logo") { asset = current.assets.logo; current.assets.logo = null; }
  else {
    asset = current.assets.references.find((item) => item.id === id) || null;
    current.assets.references = current.assets.references.filter((item) => item.id !== id);
  }
  if (asset) await blobDel(asset.path);
  return saveBrandKit(current);
}

export async function readBrandAsset(kind: BrandAsset["kind"], id?: string) {
  const kit = await getBrandKit();
  const asset = kind === "face" ? kit.assets.face : kind === "logo" ? kit.assets.logo : kit.assets.references.find((item) => item.id === id) || null;
  if (!asset) return null;
  const bytes = await blobGetBytes(asset.path);
  return bytes ? { ...bytes, asset } : null;
}

export async function loadBrandReferenceImages(): Promise<BrandReferenceImage[]> {
  const kit = await getBrandKit();
  const entries: Array<{ asset: BrandAsset | null; role: BrandReferenceImage["role"] }> = [
    { asset: kit.assets.face, role: "founder-face" },
    { asset: kit.assets.logo, role: "brand-logo" },
    ...kit.assets.references.map((asset) => ({ asset, role: "style-reference" as const })),
  ];
  const results = await Promise.all(entries.map(async ({ asset, role }) => {
    if (!asset) return null;
    const bytes = await blobGetBytes(asset.path);
    return bytes ? { data: bytes.data, name: asset.name, type: bytes.contentType || asset.contentType, role } : null;
  }));
  return results.filter((item): item is BrandReferenceImage => !!item);
}

/** Whether a pre-rendered locked carousel header exists on Blob. */
export async function hasBrandHeader(): Promise<boolean> {
  if (!blobConfigured()) return false;
  return Boolean(await blobGetBytes(BRAND_HEADER_PATH));
}

/** Sentences in a learned style spec that tell the model to DRAW the header. */
const HEADER_DIRECTIVE = new RegExp(
  [
    "identity header", "recurring header", "retain the header", "the header",
    "header (?:alignment|centerline|row|strip|bar|band|area|zone|block)",
    "between header and headline",
    "(?:creator|founder|profile) (?:portrait|photo|picture)",
    "circular (?:creator|founder)?\\s*portrait",
    "profile (?:name|row|strip|block)",
    "repost mark", "repost (?:icon|label|button)",
    "name plate", "descriptor (?:below|lines?)",
    "recurring avatar", "avatar",
  ].join("|"),
  "i",
);
/** A block whose whole subject is the header (e.g. an "Identity header: …" paragraph). */
const HEADER_BLOCK = /^\s*(?:identity|recurring|profile)?\s*header\b|^\s*identity\s+(?:block|bar|strip|row)\b|^\s*profile\s+(?:row|strip|block)\b/i;

/**
 * Remove header-drawing directives from a learned visual style spec.
 *
 * Style specs are reverse-engineered from the founder's own reference slides,
 * which carry their header — so they invariably instruct the model to paint an
 * avatar, name plate, and repost mark at the top. When the app overlays its own
 * locked header, those directives directly contradict the "leave the top strip
 * empty" rule, and they win: they arrive earlier, are marked authoritative, and
 * are far more specific. Strip them so the prompt asks for one thing only.
 */
export function stripHeaderDirectives(spec: string): string {
  return spec
    .split(/\n\s*\n/)
    .map((block) => {
      if (HEADER_BLOCK.test(block)) return "";
      // Mixed blocks (canvas/grid, recurring components, spacing) mention the
      // header inside a wider rule — drop only the offending sentences.
      const kept = block
        .split(/(?<=\.)\s+/)
        .filter((sentence) => !HEADER_DIRECTIVE.test(sentence))
        .join(" ")
        .trim();
      return kept;
    })
    .filter((block) => block.trim().length > 0)
    .join("\n\n");
}

/** A sentence carrying literal content lifted off a reference image. */
const BORROWED_CONTENT = new RegExp(
  [
    // literal copy the model was told to reproduce
    "(?:reads?|reading|says?|stating|states|spelling out|verbatim|word[- ]for[- ]word|same wording|exact (?:copy|wording|text|words))\\b",
    "(?:headline|title|label|button|caption|subtitle|banner|badge|sticker|copy|text)\\s+(?:reads?|says?|is|should (?:read|say))\\b",
    // times, dates, prices, contact details
    "\\b\\d{1,2}\\s*(?::\\s*\\d{2})?\\s*(?:am|pm)\\b",
    // Colon only, never a period: "0.85 opacity" and "1.50 line height" are style.
    "\\b\\d{1,2}:\\d{2}\\b",
    "\\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(?:uary|ruary|ch|il|e|y|ust|tember|ober|ember)?\\s+\\d{1,2}\\b",
    "\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)",
    "\\b(?:mon|tues?|wed(?:nes)?|thur?s?|fri|sat(?:ur)?|sun)(?:day)?\\s+(?:at|the|\\d)",
    // Dashes need a full year, or a "12-16-24 px" spacing scale reads as a date.
    "\\b\\d{1,2}/\\d{1,2}/\\d{2,4}\\b",
    "\\b\\d{1,2}-\\d{1,2}-\\d{4}\\b",
    "\\b\\d{4}-\\d{2}-\\d{2}\\b",
    "[$£€]\\s?\\d", "\\b\\d+\\s*(?:usd|eur|gbp|inr)\\b",
    "\\bhttps?://", "\\bwww\\.", "\\b[a-z0-9-]+\\.(?:com|net|org|io|co|ly|app|link)\\b",
    "\\b[\\w.+-]+@[\\w-]+\\.[a-z]{2,}\\b",
    // event / campaign furniture — never part of a visual system
    "\\b(?:zoom|google meet|ms teams|webinar|livestream|live stream|rsvp|register(?:ing|ed|ation)?|sign[- ]?up|tickets?|early bird|seats?|venue|doors open|admission|agenda|speakers?|panelists?|keynote|host(?:ed|ing)? by|join us|save the date|limited time|deadline|discount|coupon|promo code|call now|book (?:now|your))\\b",
  ].join("|"),
  "i",
);
/** A block whose whole subject is borrowed content (e.g. an "Event details: …" paragraph). */
const BORROWED_BLOCK =
  /^\s*(?:event|session|webinar|workshop|offer|promo(?:tion)?|campaign|ticket|pricing|price|contact|schedule|agenda|date|time|location|venue|registration|cta copy|copy|messaging|content)\s*(?:details?|info(?:rmation)?|block|panel|strip|section|line)?\s*[:\-—]/i;

/**
 * Remove content borrowed from a reference image out of a learned style spec.
 *
 * Founders upload whatever they have to hand — an event poster, a launch
 * graphic, a client's deck — and mean "make it look like this". The extractor
 * used to write what it saw into the spec as a "recurring component", so an
 * uploaded poster taught the kit that every slide carries a Zoom link and a
 * start time. The spec then arrives marked AUTHORITATIVE, ahead of and far more
 * specific than the legend's "use references for style only", so it wins.
 *
 * Extraction no longer transcribes content, but specs learned before that fix
 * are already saved, so scrub on the way into every prompt as well.
 */
export function stripBorrowedContent(spec: string): string {
  return spec
    .split(/\n\s*\n/)
    .map((block) => {
      if (BORROWED_BLOCK.test(block)) return "";
      return block
        .split(/(?<=\.)\s+/)
        .filter((sentence) => !BORROWED_CONTENT.test(sentence))
        .join(" ")
        .trim();
    })
    .filter((block) => block.trim().length > 0)
    .join("\n\n");
}

export function brandKitContext(kit: BrandKit, options: { suppressHeader?: boolean } = {}): string {
  // Borrowed content is never wanted, in any format, so it is scrubbed
  // unconditionally — unlike the header, which only yields to the overlay.
  const learned = stripBorrowedContent(kit.styleSpec);
  const styleSpec = options.suppressHeader ? stripHeaderDirectives(learned) : learned;
  const palette = kit.colors.filter((color) => color.hex).map((color) => `${color.name} ${color.hex}`).join(", ");
  const references = [
    kit.assets.face ? "founder face" : "",
    kit.assets.logo ? "logo" : "",
    kit.assets.references.length ? `${kit.assets.references.length} style reference${kit.assets.references.length === 1 ? "" : "s"}` : "",
  ].filter(Boolean).join(", ");
  // Only emit fields the founder has actually set, so an unconfigured kit stays
  // minimal and agents fall back to the second brain's Voice DNA instead of
  // empty labels.
  const configured = kit.displayName || kit.voice || styleSpec || kit.tagline;
  return [
    `# Brand Kit: ${kit.displayName || "Not configured yet"}`,
    kit.handle ? `Handle: @${kit.handle}` : "",
    kit.tagline ? `Tagline: ${kit.tagline}` : "",
    kit.website ? `Website: ${kit.website}` : "",
    palette ? `Palette: ${palette}` : "",
    kit.headlineFont ? `Headline typography: ${kit.headlineFont}` : "",
    kit.bodyFont ? `Body typography: ${kit.bodyFont}` : "",
    kit.voice ? `Voice: ${kit.voice}` : "",
    kit.vocabulary ? `Preferred language: ${kit.vocabulary}` : "",
    kit.avoid ? `Avoid: ${kit.avoid}` : "",
    styleSpec ? `Locked visual system:\n${styleSpec}` : "",
    kit.notes ? `Additional notes: ${kit.notes}` : "",
    `Available visual references: ${references || "none uploaded"}.`,
    configured ? "" : "No brand voice or visual system has been configured yet. Draw voice and style from the founder's second brain (e.g. the Voice DNA note) and keep visuals clean and neutral until a brand kit is set.",
  ].filter(Boolean).join("\n\n");
}
