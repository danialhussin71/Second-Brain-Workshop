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
  role: "founder-face" | "brand-logo" | "style-reference" | "locked-header";
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

export async function loadBrandReferenceImages(options: { includeHeader?: boolean } = {}): Promise<BrandReferenceImage[]> {
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
  const images = results.filter((item): item is BrandReferenceImage => !!item);
  if (options.includeHeader) {
    const header = await blobGetBytes(BRAND_HEADER_PATH);
    // first in the list — it is the most authoritative reference and must never
    // fall off the reference cap
    if (header) images.unshift({ data: header.data, name: "locked-header.png", type: header.contentType || "image/png", role: "locked-header" });
  }
  return images;
}

export function brandKitContext(kit: BrandKit): string {
  const palette = kit.colors.filter((color) => color.hex).map((color) => `${color.name} ${color.hex}`).join(", ");
  const references = [
    kit.assets.face ? "founder face" : "",
    kit.assets.logo ? "logo" : "",
    kit.assets.references.length ? `${kit.assets.references.length} style reference${kit.assets.references.length === 1 ? "" : "s"}` : "",
  ].filter(Boolean).join(", ");
  // Only emit fields the founder has actually set, so an unconfigured kit stays
  // minimal and agents fall back to the second brain's Voice DNA instead of
  // empty labels.
  const configured = kit.displayName || kit.voice || kit.styleSpec || kit.tagline;
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
    kit.styleSpec ? `Locked visual system:\n${kit.styleSpec}` : "",
    kit.notes ? `Additional notes: ${kit.notes}` : "",
    `Available visual references: ${references || "none uploaded"}.`,
    configured ? "" : "No brand voice or visual system has been configured yet. Draw voice and style from the founder's second brain (e.g. the Voice DNA note) and keep visuals clean and neutral until a brand kit is set.",
  ].filter(Boolean).join("\n\n");
}
