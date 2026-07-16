/**
 * Locked carousel header — rendered ONCE (client-side canvas) when the brand
 * kit is saved, stored on Blob, and sent to GPT Image as a `locked-header`
 * reference with every slide, with a prompt instruction to reproduce it
 * exactly. Because the header is rendered once, layout decisions (like whether
 * the tagline wraps to two lines) are made once and can never vary per slide.
 *
 * `carouselHeader` is pure and safe to import server-side; everything that
 * touches canvas/Image is client-only.
 */
import type { BrandKit } from "./brand-kit";

/** Native size of the rendered header strip (slide width × band height). */
export const HEADER_W = 1088;
export const HEADER_H = 208;

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

/** Wrap text into at most `maxLines` lines, ellipsizing the final line. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines - 1) break;
  }
  if (line) lines.push(line);
  const rest = words.slice(lines.join(" ").split(/\s+/).length).join(" ");
  if (rest) lines[lines.length - 1] = `${lines[lines.length - 1]} ${rest}`;
  return lines.slice(0, maxLines).map((entry, index) => {
    if (index < maxLines - 1 || ctx.measureText(entry).width <= maxWidth) return entry;
    let out = entry;
    while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1).trimEnd();
    return `${out}…`;
  });
}

/** The repost glyph — two horizontal arrows forming an open cycle. */
function drawRepostIcon(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  const lw = 5;
  const head = 12;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const topY = y + lw / 2;
  const botY = y + h - lw / 2;
  const hook = h * 0.4;
  // top arrow → right, with a down-hook on the left
  ctx.beginPath();
  ctx.moveTo(x + lw / 2, topY + hook);
  ctx.lineTo(x + lw / 2, topY);
  ctx.lineTo(x + w - head - 2, topY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + w - head, topY - head * 0.72);
  ctx.lineTo(x + w, topY);
  ctx.lineTo(x + w - head, topY + head * 0.72);
  ctx.closePath();
  ctx.fill();
  // bottom arrow ← left, with an up-hook on the right
  ctx.beginPath();
  ctx.moveTo(x + w - lw / 2, botY - hook);
  ctx.lineTo(x + w - lw / 2, botY);
  ctx.lineTo(x + head + 2, botY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + head, botY - head * 0.72);
  ctx.lineTo(x, botY);
  ctx.lineTo(x + head, botY + head * 0.72);
  ctx.closePath();
  ctx.fill();
}

/**
 * Render the locked header strip in the founder's theme: a rounded-top band in
 * the brand background color, avatar + name + tagline (wrapped once, max two
 * lines) on the left, a REPOST mark on the right. Transparent above the band
 * and in the corners so the slide's own artwork shows through.
 */
export async function renderBrandHeader(header: CarouselHeader, avatar: HTMLImageElement | null): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = HEADER_W;
  canvas.height = HEADER_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const onDark = luminance(header.bandHex) < 0.55;
  const text = onDark ? "#FFFFFF" : "#0B0C10";
  const muted = onDark ? "rgba(255,255,255,0.66)" : "rgba(11,12,16,0.66)";
  const family = (typeof document !== "undefined" && getComputedStyle(document.body).fontFamily) || "system-ui, sans-serif";

  // the band — rounded top corners, square bottom (it continues into the slide)
  const bandY = 16;
  const r = 30;
  ctx.beginPath();
  ctx.moveTo(0, HEADER_H);
  ctx.lineTo(0, bandY + r);
  ctx.arcTo(0, bandY, r, bandY, r);
  ctx.lineTo(HEADER_W - r, bandY);
  ctx.arcTo(HEADER_W, bandY, HEADER_W, bandY + r, r);
  ctx.lineTo(HEADER_W, HEADER_H);
  ctx.closePath();
  ctx.fillStyle = header.bandHex;
  ctx.fill();
  // hairline top sheen so the band edge reads crisply on any background
  ctx.strokeStyle = onDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const padX = 56;
  const bandH = HEADER_H - bandY;
  let textX = padX;

  // avatar (or accent initial) in a circle, vertically centered in the band
  if (avatar || header.name) {
    const d = 104;
    const ay = bandY + (bandH - d) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(padX + d / 2, ay + d / 2, d / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    if (avatar) {
      const iw = avatar.naturalWidth || 1;
      const ih = avatar.naturalHeight || 1;
      const scale = Math.max(d / iw, d / ih);
      ctx.drawImage(avatar, padX + (d - iw * scale) / 2, ay + (d - ih * scale) / 2, iw * scale, ih * scale);
    } else {
      ctx.fillStyle = header.accentHex;
      ctx.fillRect(padX, ay, d, d);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `600 46px ${family}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(header.name.slice(0, 1).toUpperCase(), padX + d / 2, ay + d / 2 + 2);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(padX + d / 2, ay + d / 2, d / 2, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(header.accentHex, 0.55);
    ctx.lineWidth = 2.5;
    ctx.stroke();
    textX = padX + d + 28;
  }

  // REPOST mark on the right
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "right";
  ctx.font = `700 30px ${family}`;
  ctx.fillStyle = text;
  const repostLabel = "REPOST";
  const labelW = ctx.measureText(repostLabel).width;
  const iconW = 54;
  const iconH = 34;
  const iconGap = 20;
  const repostLeft = HEADER_W - padX - labelW - iconGap - iconW;
  ctx.fillText(repostLabel, HEADER_W - padX, bandY + bandH / 2 + 11);
  drawRepostIcon(ctx, repostLeft, bandY + bandH / 2 - iconH / 2, iconW, iconH, text);

  // name + tagline, wrapped ONCE — this render decides the line breaks forever
  ctx.textAlign = "left";
  const maxTextW = repostLeft - 36 - textX;
  ctx.font = `400 23px ${family}`;
  const taglineLines = header.tagline ? wrapText(ctx, header.tagline, maxTextW, 2) : [];
  const nameH = header.name ? 40 : 0;
  const tagH = taglineLines.length * 32;
  let cursorY = bandY + (bandH - nameH - tagH) / 2;
  if (header.name) {
    ctx.font = `650 34px ${family}`;
    ctx.fillStyle = text;
    let display = header.name;
    while (display.length > 1 && ctx.measureText(display).width > maxTextW) display = display.slice(0, -1).trimEnd();
    ctx.fillText(display, textX, cursorY + 32);
    cursorY += nameH + 4;
  }
  ctx.font = `400 23px ${family}`;
  ctx.fillStyle = muted;
  for (const line of taglineLines) {
    ctx.fillText(line, textX, cursorY + 23);
    cursorY += 32;
  }

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}
