import type { LongformArtifactData, ReelArtifactData } from "./jarvis-events";

type PdfLib = typeof import("pdf-lib");
type PdfDoc = import("pdf-lib").PDFDocument;
type PdfPage = import("pdf-lib").PDFPage;
type PdfFont = import("pdf-lib").PDFFont;
type PdfColor = import("pdf-lib").RGB;
type PdfImage = import("pdf-lib").PDFImage;

const PAGE = { width: 595.28, height: 841.89, margin: 52 };
const CW = PAGE.width - PAGE.margin * 2; // content width
const HEADER_H = 96; // reserved masthead band at the top of every page
const FOOTER_H = 52; // reserved footer band at the bottom of every page

type ColorTuple = readonly [number, number, number];
const COLORS: Record<
  | "paper" | "ink" | "muted" | "faint" | "line" | "hair" | "card" | "soft"
  | "white" | "crimson" | "crimsonSoft" | "cyan" | "cyanSoft" | "green"
  | "greenSoft" | "amber" | "amberSoft" | "violet" | "violetSoft",
  ColorTuple
> = {
  paper: [0.976, 0.969, 0.953] as const,
  ink: [0.071, 0.082, 0.106] as const,
  muted: [0.4, 0.42, 0.46] as const,
  faint: [0.56, 0.57, 0.6] as const,
  line: [0.86, 0.84, 0.79] as const,
  hair: [0.9, 0.88, 0.84] as const,
  card: [1, 1, 1] as const,
  soft: [0.955, 0.948, 0.928] as const,
  white: [1, 1, 1] as const,
  crimson: [0.929, 0.094, 0.275] as const,
  crimsonSoft: [0.988, 0.914, 0.933] as const,
  cyan: [0.02, 0.53, 0.66] as const,
  cyanSoft: [0.9, 0.965, 0.976] as const,
  green: [0.055, 0.53, 0.37] as const,
  greenSoft: [0.902, 0.965, 0.941] as const,
  amber: [0.78, 0.47, 0.04] as const,
  amberSoft: [0.984, 0.945, 0.87] as const,
  violet: [0.45, 0.36, 0.86] as const,
  violetSoft: [0.936, 0.928, 0.98] as const,
};

function safeText(value: string): string {
  return value
    .replace(/\s*[—―]\s*/g, ", ")
    .replace(/([0-9])\s*[‒–]\s*([0-9])/g, "$1 to $2")
    .replace(/[‒–−]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/•/g, "-")
    .normalize("NFKD")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
    .replace(/ +,/g, ",")
    .trim();
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "second-brain-script";
}

/** SVG path for a rounded rectangle, drawn from its top-left corner (SVG y-down). */
function roundRectPath(w: number, h: number, r: number): string {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  return [
    `M ${radius} 0`,
    `H ${w - radius}`,
    `A ${radius} ${radius} 0 0 1 ${w} ${radius}`,
    `V ${h - radius}`,
    `A ${radius} ${radius} 0 0 1 ${w - radius} ${h}`,
    `H ${radius}`,
    `A ${radius} ${radius} 0 0 1 0 ${h - radius}`,
    `V ${radius}`,
    `A ${radius} ${radius} 0 0 1 ${radius} 0`,
    "Z",
  ].join(" ");
}

class ScriptPdf {
  private page!: PdfPage;
  private y = 0;
  private pages: PdfPage[] = [];
  private readonly lib: PdfLib;
  private readonly doc: PdfDoc;
  private readonly regular: PdfFont;
  private readonly bold: PdfFont;
  private readonly artifactType: string;
  private readonly brandMark?: PdfImage;
  private readonly publisherMark?: PdfImage;

  constructor(
    lib: PdfLib,
    doc: PdfDoc,
    regular: PdfFont,
    bold: PdfFont,
    artifactType: string,
    brandMark?: PdfImage,
    publisherMark?: PdfImage,
  ) {
    this.lib = lib;
    this.doc = doc;
    this.regular = regular;
    this.bold = bold;
    this.artifactType = artifactType;
    this.brandMark = brandMark; // Second Brain (product) mark — left of the header
    this.publisherMark = publisherMark; // Purely Personal mark — right of the header
  }

  private color(values: readonly number[]): PdfColor {
    return this.lib.rgb(values[0], values[1], values[2]);
  }

  private textW(text: string, font: PdfFont, size: number): number {
    return font.widthOfTextAtSize(text, size);
  }

  /** Draw a rounded rectangle whose top-left sits at (left, top) in PDF coords. */
  private roundRect(
    left: number,
    top: number,
    w: number,
    h: number,
    opts: { fill?: ColorTuple; border?: ColorTuple; borderWidth?: number; radius?: number },
  ) {
    this.page.drawSvgPath(roundRectPath(w, h, opts.radius ?? 9), {
      x: left,
      y: top,
      color: opts.fill ? this.color(opts.fill) : undefined,
      borderColor: opts.border ? this.color(opts.border) : undefined,
      borderWidth: opts.borderWidth ?? (opts.border ? 0.8 : 0),
    });
  }

  /** A small pill/chip with centered label. Returns the pill width. */
  private chip(
    left: number,
    centerY: number,
    label: string,
    opts: { fill?: ColorTuple; text?: ColorTuple; border?: ColorTuple; size?: number } = {},
  ): number {
    const value = safeText(label).toUpperCase();
    const size = opts.size ?? 7;
    const padX = 7;
    const h = size + 8.5;
    const w = this.textW(value, this.bold, size) + padX * 2;
    this.roundRect(left, centerY + h / 2, w, h, { fill: opts.fill, border: opts.border, borderWidth: 0.8, radius: h / 2 });
    this.page.drawText(value, {
      x: left + padX,
      y: centerY - size / 2 + 1.2,
      size,
      font: this.bold,
      color: this.color(opts.text ?? COLORS.white),
    });
    return w;
  }

  private wrap(text: string, font: PdfFont, size: number, maxWidth: number): string[] {
    const paragraphs = safeText(text).split(/\n+/);
    const lines: string[] = [];
    for (const paragraph of paragraphs) {
      if (!paragraph) { lines.push(""); continue; }
      const words = paragraph.split(/\s+/);
      let line = "";
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (this.textW(next, font, size) <= maxWidth || !line) line = next;
        else { lines.push(line); line = word; }
      }
      if (line) lines.push(line);
    }
    return lines;
  }

  newPage() {
    this.page = this.doc.addPage([PAGE.width, PAGE.height]);
    this.pages.push(this.page);
    this.page.drawRectangle({ x: 0, y: 0, width: PAGE.width, height: PAGE.height, color: this.color(COLORS.paper) });
    this.drawHeader();
    this.y = PAGE.height - HEADER_H;
  }

  private drawHeader() {
    const top = PAGE.height;
    // Masthead accent bar, edge to edge.
    this.page.drawRectangle({ x: 0, y: top - 5, width: PAGE.width, height: 5, color: this.color(COLORS.crimson) });

    const markSize = 26;
    const markBottom = top - 54;
    const nameBaseline = top - 44;

    // Left lockup — Second Brain OS (the product).
    let lx = PAGE.margin;
    if (this.brandMark) {
      this.page.drawImage(this.brandMark, { x: lx, y: markBottom, width: markSize, height: markSize });
      lx += markSize + 9;
    }
    this.page.drawText("Second Brain OS", { x: lx, y: nameBaseline, size: 11, font: this.bold, color: this.color(COLORS.ink) });
    this.page.drawText("KNOWLEDGE, ENGINEERED INTO CONTENT", { x: lx, y: nameBaseline - 10, size: 5.3, font: this.bold, color: this.color(COLORS.faint) });

    // Right lockup — Product of Purely Personal (the publisher).
    let rEnd = PAGE.width - PAGE.margin;
    if (this.publisherMark) {
      this.page.drawImage(this.publisherMark, { x: rEnd - markSize, y: markBottom, width: markSize, height: markSize });
      rEnd -= markSize + 9;
    }
    const label = "PRODUCT OF";
    const name = "Purely Personal";
    this.page.drawText(label, { x: rEnd - this.textW(label, this.bold, 5.3), y: nameBaseline + 4, size: 5.3, font: this.bold, color: this.color(COLORS.faint) });
    this.page.drawText(name, { x: rEnd - this.textW(name, this.bold, 11), y: nameBaseline - 8, size: 11, font: this.bold, color: this.color(COLORS.ink) });

    // Hairline separating the masthead from the body.
    this.page.drawLine({ start: { x: PAGE.margin, y: top - 68 }, end: { x: PAGE.width - PAGE.margin, y: top - 68 }, thickness: 0.6, color: this.color(COLORS.line) });
  }

  ensure(height: number) {
    if (!this.page || this.y - height < FOOTER_H + 8) this.newPage();
  }

  /** Cover masthead: kicker badge, big title, subtitle, meta row, divider. */
  masthead(title: string, subtitle: string, meta: string[]) {
    // Kicker badge (document type).
    const badge = safeText(this.artifactType).toUpperCase();
    const badgeSize = 7.5;
    const badgeH = badgeSize + 9;
    const badgeW = this.textW(badge, this.bold, badgeSize) + 20;
    this.roundRect(PAGE.margin, this.y, badgeW, badgeH, { fill: COLORS.crimson, radius: badgeH / 2 });
    this.page.drawText(badge, { x: PAGE.margin + 10, y: this.y - badgeH + (badgeH - badgeSize) / 2 + 1.5, size: badgeSize, font: this.bold, color: this.color(COLORS.white) });
    this.y -= badgeH + 18;

    // Title.
    const clean = safeText(title);
    const size = clean.length > 72 ? 22 : clean.length > 46 ? 26 : 30;
    const leading = size * 1.12;
    const lines = this.wrap(clean, this.bold, size, CW);
    for (const line of lines) {
      this.ensure(leading);
      this.page.drawText(line, { x: PAGE.margin, y: this.y - size, size, font: this.bold, color: this.color(COLORS.ink) });
      this.y -= leading;
    }
    this.y -= 6;

    // Subtitle.
    if (subtitle) {
      const subLines = this.wrap(subtitle, this.regular, 11, CW);
      for (const line of subLines) {
        this.page.drawText(line, { x: PAGE.margin, y: this.y - 11, size: 11, font: this.regular, color: this.color(COLORS.muted) });
        this.y -= 16;
      }
    }
    this.y -= 8;

    // Meta row of chips.
    let x = PAGE.margin;
    const chipCenter = this.y - 8;
    for (const item of meta) {
      x += this.chip(x, chipCenter, item, { border: COLORS.line, text: COLORS.muted, fill: COLORS.card, size: 7 }) + 7;
    }
    this.y -= 30;

    // Divider.
    this.page.drawLine({ start: { x: PAGE.margin, y: this.y }, end: { x: PAGE.width - PAGE.margin, y: this.y }, thickness: 1.4, color: this.color(COLORS.ink) });
    this.y -= 26;
  }

  section(text: string, accent: ColorTuple = COLORS.ink) {
    this.ensure(34);
    this.y -= 2;
    const label = safeText(text).toUpperCase();
    // Accent tick.
    this.roundRect(PAGE.margin, this.y + 3, 14, 5, { fill: accent, radius: 2.5 });
    this.page.drawText(label, { x: PAGE.margin + 22, y: this.y - 6, size: 9, font: this.bold, color: this.color(COLORS.ink) });
    const labelWidth = this.textW(label, this.bold, 9);
    this.page.drawLine({ start: { x: PAGE.margin + 22 + labelWidth + 12, y: this.y - 3 }, end: { x: PAGE.width - PAGE.margin, y: this.y - 3 }, thickness: 0.6, color: this.color(COLORS.line) });
    this.y -= 26;
  }

  paragraph(text: string, options: { size?: number; color?: ColorTuple; indent?: number; leading?: number } = {}) {
    const size = options.size ?? 10.5;
    const leading = options.leading ?? size * 1.5;
    const indent = options.indent ?? 0;
    const lines = this.wrap(text, this.regular, size, CW - indent);
    for (const line of lines) {
      this.ensure(leading);
      if (line) this.page.drawText(line, { x: PAGE.margin + indent, y: this.y - size, size, font: this.regular, color: this.color(options.color ?? COLORS.ink) });
      this.y -= leading;
    }
    this.y -= 6;
  }

  /** A soft card with a colored label chip and body copy. */
  callout(label: string, body: string, accent: ColorTuple = COLORS.crimson, tint: ColorTuple = COLORS.soft) {
    const padX = 16;
    const innerW = CW - padX * 2;
    const bodyLines = this.wrap(body, this.regular, 10.8, innerW);
    const height = 22 + 13 + bodyLines.length * 15.5 + 4;
    this.ensure(height + 8);
    const top = this.y;
    const bottom = top - height;
    this.roundRect(PAGE.margin, top, CW, height, { fill: tint, radius: 11 });
    // Accent rail on the left edge.
    this.roundRect(PAGE.margin, top, 4, height, { fill: accent, radius: 2 });
    this.page.drawText(safeText(label).toUpperCase(), { x: PAGE.margin + padX, y: top - 19, size: 7.2, font: this.bold, color: this.color(accent) });
    let lineY = top - 19 - 17;
    for (const line of bodyLines) {
      this.page.drawText(line, { x: PAGE.margin + padX, y: lineY, size: 10.8, font: this.regular, color: this.color(COLORS.ink) });
      lineY -= 15.5;
    }
    this.y = bottom - 16;
  }

  /** One reel beat rendered as a timeline card. */
  beat(index: number, timecode: string, duration: number, spoken: string, details: Array<[string, string, ColorTuple, ColorTuple]>) {
    const padX = 16;
    const innerW = CW - padX * 2;
    const spokenLines = this.wrap(spoken, this.regular, 11, innerW);
    // Pre-measure detail rows.
    const measured = details.map(([label, body, accent, tint]) => {
      const labelChipW = this.textW(safeText(label).toUpperCase(), this.bold, 6.3) + 14;
      const bodyLines = this.wrap(body || "None", this.regular, 8.8, innerW - labelChipW - 8);
      return { label, accent, tint, labelChipW, bodyLines };
    });
    const detailsH = measured.reduce((sum, d) => sum + Math.max(15, d.bodyLines.length * 11.5 + 5), 0);
    const height = 24 + spokenLines.length * 15.5 + 8 + detailsH + 12;
    this.ensure(height + 10);
    const top = this.y;
    const bottom = top - height;
    this.roundRect(PAGE.margin, top, CW, height, { fill: COLORS.card, border: COLORS.hair, borderWidth: 0.9, radius: 12 });

    // Header row: timecode chip + duration + beat index.
    const chipW = this.chip(PAGE.margin + padX, top - 15, timecode, { fill: COLORS.crimson, text: COLORS.white, size: 7 });
    if (duration) {
      this.page.drawText(`${duration}s`, { x: PAGE.margin + padX + chipW + 8, y: top - 18, size: 7.5, font: this.regular, color: this.color(COLORS.muted) });
    }
    const idx = String(index).padStart(2, "0");
    this.page.drawText(idx, { x: PAGE.width - PAGE.margin - padX - this.textW(idx, this.bold, 8), y: top - 18, size: 8, font: this.bold, color: this.color(COLORS.faint) });

    // Spoken copy.
    let lineY = top - 32;
    for (const line of spokenLines) {
      this.page.drawText(line, { x: PAGE.margin + padX, y: lineY, size: 11, font: this.regular, color: this.color(COLORS.ink) });
      lineY -= 15.5;
    }
    lineY -= 6;

    // Detail rows with colored label chips.
    for (const d of measured) {
      const rowH = Math.max(15, d.bodyLines.length * 11.5 + 5);
      const chipCenterY = lineY - 4;
      this.chip(PAGE.margin + padX, chipCenterY, d.label, { fill: d.tint, text: d.accent, size: 6.3 });
      const bx = PAGE.margin + padX + d.labelChipW + 8;
      let by = lineY - 4;
      for (const line of d.bodyLines) {
        this.page.drawText(line, { x: bx, y: by - 3.5, size: 8.8, font: this.regular, color: this.color(COLORS.muted) });
        by -= 11.5;
      }
      lineY -= rowH;
    }
    this.y = bottom - 16;
  }

  /** One long-form chapter. */
  chapter(n: number, timecode: string, title: string, objective: string, script: string, visuals: string[], retention: string) {
    this.ensure(120);
    this.y -= 2;
    const number = String(n).padStart(2, "0");
    // Chapter header: big number on the left; timecode chip over the title.
    const headX = PAGE.margin + 50;
    this.page.drawText(number, { x: PAGE.margin, y: this.y - 30, size: 26, font: this.bold, color: this.color(COLORS.crimson) });
    this.chip(headX, this.y - 6, timecode, { fill: COLORS.crimsonSoft, text: COLORS.crimson, size: 6.5 });
    const titleLines = this.wrap(title, this.bold, 15, CW - 50);
    let ty = this.y - 32;
    for (const line of titleLines) {
      this.page.drawText(line, { x: headX, y: ty, size: 15, font: this.bold, color: this.color(COLORS.ink) });
      ty -= 18;
    }
    this.y = ty - 4;
    // Objective.
    for (const line of this.wrap(objective, this.regular, 9, CW)) {
      this.ensure(13);
      this.page.drawText(line, { x: PAGE.margin, y: this.y - 9, size: 9, font: this.regular, color: this.color(COLORS.muted) });
      this.y -= 13;
    }
    this.y -= 8;

    // Script.
    this.paragraph(script, { size: 10.4, leading: 16 });

    // Visual plan.
    this.ensure(visuals.length * 14 + 30);
    this.chip(PAGE.margin, this.y - 4, "Visual plan", { fill: COLORS.cyanSoft, text: COLORS.cyan, size: 6.5 });
    this.y -= 22;
    for (const visual of visuals) {
      const lines = this.wrap(visual, this.regular, 9, CW - 16);
      this.ensure(lines.length * 13 + 4);
      this.page.drawCircle({ x: PAGE.margin + 4, y: this.y - 6, size: 1.7, color: this.color(COLORS.cyan) });
      for (const line of lines) {
        this.page.drawText(line, { x: PAGE.margin + 14, y: this.y - 9, size: 9, font: this.regular, color: this.color(COLORS.muted) });
        this.y -= 13;
      }
    }
    this.y -= 6;

    // Retention device callout.
    this.callout("Retention device", retention, COLORS.amber, COLORS.amberSoft);
  }

  numberedList(items: string[], accent: ColorTuple = COLORS.crimson, tint: ColorTuple = COLORS.crimsonSoft) {
    for (const [index, item] of items.entries()) {
      const lines = this.wrap(item, this.regular, 10, CW - 42);
      this.ensure(lines.length * 15 + 12);
      const top = this.y;
      const badge = 20;
      this.roundRect(PAGE.margin, top - 2, badge, badge, { fill: tint, radius: 6 });
      const n = String(index + 1).padStart(2, "0");
      this.page.drawText(n, { x: PAGE.margin + (badge - this.textW(n, this.bold, 8)) / 2, y: top - 15, size: 8, font: this.bold, color: this.color(accent) });
      let ly = top - 11;
      for (const line of lines) {
        this.page.drawText(line, { x: PAGE.margin + badge + 12, y: ly, size: 10, font: this.regular, color: this.color(COLORS.ink) });
        ly -= 15;
      }
      this.y = Math.min(ly, top - badge) - 8;
    }
  }

  /** A numbered step used for shot lists / production notes. */
  steps(items: string[], accent: ColorTuple = COLORS.cyan) {
    for (const [index, item] of items.entries()) {
      const lines = this.wrap(item, this.regular, 9.4, CW - 30);
      this.ensure(lines.length * 13.5 + 6);
      const n = String(index + 1).padStart(2, "0");
      this.page.drawText(n, { x: PAGE.margin, y: this.y - 9, size: 8.5, font: this.bold, color: this.color(accent) });
      let ly = this.y;
      for (const line of lines) {
        this.page.drawText(line, { x: PAGE.margin + 26, y: ly - 9, size: 9.4, font: this.regular, color: this.color(COLORS.ink) });
        ly -= 13.5;
      }
      this.y = ly - 5;
    }
  }

  finish() {
    const total = this.pages.length;
    this.pages.forEach((page, index) => {
      page.drawLine({ start: { x: PAGE.margin, y: 40 }, end: { x: PAGE.width - PAGE.margin, y: 40 }, thickness: 0.6, color: this.color(COLORS.line) });
      // Left brand line.
      const brand = "Second Brain OS";
      page.drawText(brand, { x: PAGE.margin, y: 26, size: 6.8, font: this.bold, color: this.color(COLORS.ink) });
      const brandW = this.textW(brand, this.bold, 6.8);
      page.drawText("   Product of Purely Personal", { x: PAGE.margin + brandW, y: 26, size: 6.8, font: this.regular, color: this.color(COLORS.muted) });
      // Right page number.
      const pageNo = `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
      const width = this.textW(pageNo, this.bold, 7.2);
      page.drawText(pageNo, { x: PAGE.width - PAGE.margin - width, y: 26, size: 7.2, font: this.bold, color: this.color(COLORS.ink) });
    });
  }
}

async function setup(type: string, brandMarkBytes?: Uint8Array, publisherMarkBytes?: Uint8Array) {
  const lib = await import("pdf-lib");
  const doc = await lib.PDFDocument.create();
  doc.setTitle(`Second Brain OS | ${type}`);
  doc.setAuthor("Purely Personal");
  doc.setCreator("Second Brain OS");
  doc.setProducer("Second Brain OS by Purely Personal");
  const regular = await doc.embedFont(lib.StandardFonts.Helvetica);
  const bold = await doc.embedFont(lib.StandardFonts.HelveticaBold);

  let brandBytes = brandMarkBytes;
  if (!brandBytes && typeof window !== "undefined") {
    try {
      const response = await fetch("/brand/second-brain-icon.png");
      if (response.ok) brandBytes = new Uint8Array(await response.arrayBuffer());
    } catch { /* The text wordmark remains when the icon cannot load. */ }
  }
  let publisherBytes = publisherMarkBytes;
  if (!publisherBytes && typeof window !== "undefined") {
    try {
      const response = await fetch("/brand/purely-personal-mark.png");
      if (response.ok) publisherBytes = new Uint8Array(await response.arrayBuffer());
    } catch { /* PDF remains usable without the publisher mark. */ }
  }
  const brandMark = brandBytes ? await doc.embedPng(brandBytes) : undefined;
  const publisherMark = publisherBytes ? await doc.embedPng(publisherBytes) : undefined;
  return { doc, pdf: new ScriptPdf(lib, doc, regular, bold, type, brandMark, publisherMark) };
}

export async function createReelScriptPdf(data: ReelArtifactData, brandMarkBytes?: Uint8Array, publisherMarkBytes?: Uint8Array): Promise<Uint8Array> {
  const { doc, pdf } = await setup("Reel production script", brandMarkBytes, publisherMarkBytes);
  pdf.newPage();
  pdf.masthead(data.title, "A production-ready short-form script, timed and shot-listed.", [data.platform, `${data.duration_seconds} seconds`, `${data.word_count} words`]);

  pdf.callout("Objective", data.objective, COLORS.cyan, COLORS.cyanSoft);
  pdf.callout("Winning hook", data.hook.spoken, COLORS.crimson, COLORS.crimsonSoft);

  pdf.section("Timecoded production script", COLORS.crimson);
  data.beats.forEach((b, index) => pdf.beat(index + 1, b.timecode, b.duration_seconds, b.spoken, [
    ["Visual", b.visual, COLORS.cyan, COLORS.cyanSoft],
    ["On screen", b.onscreen_text, COLORS.amber, COLORS.amberSoft],
    ["Edit", b.edit, COLORS.green, COLORS.greenSoft],
  ]));

  pdf.section("Publishing package", COLORS.green);
  pdf.callout("Call to action", data.cta, COLORS.green, COLORS.greenSoft);
  pdf.paragraph(data.caption);

  pdf.section("Production direction", COLORS.cyan);
  pdf.callout("Delivery", data.production.delivery, COLORS.crimson, COLORS.crimsonSoft);
  pdf.callout("Music", data.production.music, COLORS.cyan, COLORS.cyanSoft);
  pdf.callout("Caption treatment", data.production.captions, COLORS.amber, COLORS.amberSoft);
  pdf.section("Shot list", COLORS.violet);
  pdf.steps(data.production.shot_list, COLORS.violet);

  pdf.finish();
  return doc.save();
}

export async function createLongformScriptPdf(data: LongformArtifactData, brandMarkBytes?: Uint8Array, publisherMarkBytes?: Uint8Array): Promise<Uint8Array> {
  const { doc, pdf } = await setup("Long-form video script", brandMarkBytes, publisherMarkBytes);
  pdf.newPage();
  pdf.masthead(data.title, "A retention-engineered long-form script, chaptered and packaged.", [data.format, `${data.target_minutes} minutes`, `${data.estimated_words} words`]);

  pdf.callout("Click promise", data.click_promise, COLORS.cyan, COLORS.cyanSoft);

  pdf.section("Packaging", COLORS.crimson);
  pdf.callout("Thumbnail text", data.thumbnail.text, COLORS.crimson, COLORS.crimsonSoft);
  pdf.paragraph(data.thumbnail.concept, { color: COLORS.muted });

  pdf.section("Payoff map", COLORS.amber);
  pdf.numberedList(data.payoff_map, COLORS.amber, COLORS.amberSoft);

  pdf.section("Script", COLORS.crimson);
  pdf.callout("0:00  Click confirmation", data.intro, COLORS.crimson, COLORS.crimsonSoft);
  data.chapters.forEach((chapter) => pdf.chapter(chapter.n, chapter.timecode, chapter.title, chapter.objective, chapter.script, chapter.visuals, chapter.retention_device));

  pdf.section("Ending system", COLORS.green);
  pdf.callout("Subscribe line", data.subscribe_line, COLORS.cyan, COLORS.cyanSoft);
  pdf.callout("Final payoff", data.final_payoff, COLORS.green, COLORS.greenSoft);
  pdf.callout("Watch-next bridge", data.watch_next_bridge, COLORS.crimson, COLORS.crimsonSoft);

  pdf.section("Production notes", COLORS.violet);
  pdf.steps(data.production_notes, COLORS.violet);

  pdf.finish();
  return doc.save();
}

export function downloadPdf(bytes: Uint8Array, title: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slug(title)}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}
