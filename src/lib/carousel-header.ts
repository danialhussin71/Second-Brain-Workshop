/**
 * Locked carousel header — the model repaints every pixel it draws, so a
 * "consistent header" prompt (or even a reference image) still drifts between
 * slides. Instead we reserve a flat band at the top of every slide and stamp a
 * deterministically rendered header (avatar + name + tagline + handle) onto it
 * after generation. Identical on every slide by construction.
 *
 * `carouselHeader` is pure and shared with the API route (it decides whether a
 * band is reserved in the prompt); the canvas compositor below is client-only.
 */
import type { BrandKit } from "./brand-kit";

/** Header band height relative to the 1088×1360 slide. */
export const HEADER_BAND = 124 / 1360;

export type CarouselHeader = {
  name: string;
  tagline: string;
  handle: string;
  bandHex: string;
  accentHex: string;
  hasFace: boolean;
};

const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const luminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const rgba = (hex: string, alpha: number) => `rgba(${hexToRgb(hex).join(",")},${alpha})`;

/**
 * Derive the locked header from the brand kit, or null when the kit carries no
 * identity yet (blank default) — then slides render exactly as before.
 */
export function carouselHeader(kit: BrandKit): CarouselHeader | null {
  const name = kit.displayName.trim();
  const tagline = kit.tagline.trim();
  const handle = kit.handle.trim();
  const hasFace = Boolean(kit.assets.face);
  if (!name && !tagline && !handle && !hasFace) return null;
  const byName = (re: RegExp) => kit.colors.find((c) => re.test(c.name) && /^#[0-9A-F]{6}$/i.test(c.hex))?.hex;
  return {
    name,
    tagline,
    handle,
    bandHex: byName(/back|ink|dark/i) || kit.colors[1]?.hex || "#0B0C10",
    accentHex: byName(/accent|primary|brand/i) || kit.colors[0]?.hex || "#5B677A",
    hasFace,
  };
}

/** Load an image element (client-side), rejecting on 404/network failure. */
export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

const ellipsize = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1).trimEnd();
  return `${out}…`;
};

/**
 * Stamp the locked header band onto a generated slide. Returns a new PNG data
 * URL at the slide's native size. The band is opaque, so the result is
 * pixel-identical across slides even when the model ignores the reserve
 * instruction.
 */
export async function composeSlideWithHeader(
  slideDataUrl: string,
  header: CarouselHeader,
  avatar: HTMLImageElement | null,
): Promise<string> {
  const slide = await loadImageElement(slideDataUrl);
  const W = slide.naturalWidth || 1088;
  const H = slide.naturalHeight || 1360;
  const s = W / 1088; // scale every metric off the canonical width
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return slideDataUrl;
  ctx.drawImage(slide, 0, 0, W, H);

  const bandH = Math.round(HEADER_BAND * 1360 * s);
  const onDark = luminance(header.bandHex) < 0.55;
  const text = onDark ? "#FFFFFF" : "#0B0C10";
  const muted = onDark ? "rgba(255,255,255,0.62)" : "rgba(11,12,16,0.62)";
  const family = (typeof document !== "undefined" && getComputedStyle(document.body).fontFamily) || "system-ui, sans-serif";

  ctx.fillStyle = header.bandHex;
  ctx.fillRect(0, 0, W, bandH);
  ctx.fillStyle = rgba(header.accentHex, 0.65);
  ctx.fillRect(0, bandH - 2 * s, W, 2 * s);

  const padX = 52 * s;
  const d = 66 * s;
  const avatarY = (bandH - 2 * s - d) / 2;
  let textX = padX;

  if (avatar || header.name) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(padX + d / 2, avatarY + d / 2, d / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    if (avatar) {
      // cover-fit the face into the circle
      const iw = avatar.naturalWidth || 1;
      const ih = avatar.naturalHeight || 1;
      const scale = Math.max(d / iw, d / ih);
      ctx.drawImage(avatar, padX + (d - iw * scale) / 2, avatarY + (d - ih * scale) / 2, iw * scale, ih * scale);
    } else {
      ctx.fillStyle = header.accentHex;
      ctx.fillRect(padX, avatarY, d, d);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `600 ${30 * s}px ${family}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(header.name.slice(0, 1).toUpperCase(), padX + d / 2, avatarY + d / 2 + 1 * s);
    }
    ctx.restore();
    // hairline ring so the cutout sits cleanly on the band
    ctx.beginPath();
    ctx.arc(padX + d / 2, avatarY + d / 2, d / 2, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(header.accentHex, 0.5);
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();
    textX = padX + d + 18 * s;
  }

  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  let rightW = 0;
  if (header.handle) {
    ctx.font = `600 ${19 * s}px ${family}`;
    ctx.fillStyle = muted;
    const label = `@${header.handle}`;
    rightW = ctx.measureText(label).width;
    ctx.fillText(label, W - padX, (bandH - 2 * s) / 2 + 7 * s);
  }

  ctx.textAlign = "left";
  const maxTextW = W - padX - textX - (rightW ? rightW + 26 * s : 0);
  const centerBaseline = (bandH - 2 * s) / 2 + 9 * s;
  if (header.name && header.tagline) {
    ctx.font = `650 ${25 * s}px ${family}`;
    ctx.fillStyle = text;
    ctx.fillText(ellipsize(ctx, header.name, maxTextW), textX, (bandH - 2 * s) / 2 - 5 * s);
    ctx.font = `400 ${18 * s}px ${family}`;
    ctx.fillStyle = muted;
    ctx.fillText(ellipsize(ctx, header.tagline, maxTextW), textX, (bandH - 2 * s) / 2 + 21 * s);
  } else if (header.name || header.tagline) {
    const solo = header.name || header.tagline;
    ctx.font = header.name ? `650 ${26 * s}px ${family}` : `450 ${21 * s}px ${family}`;
    ctx.fillStyle = header.name ? text : muted;
    ctx.fillText(ellipsize(ctx, solo, maxTextW), textX, centerBaseline);
  }

  return canvas.toDataURL("image/png");
}
