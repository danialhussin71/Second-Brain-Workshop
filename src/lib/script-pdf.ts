import type { LongformArtifactData, ReelArtifactData } from "./jarvis-events";

type PdfLib = typeof import("pdf-lib");
type PdfDoc = import("pdf-lib").PDFDocument;
type PdfPage = import("pdf-lib").PDFPage;
type PdfFont = import("pdf-lib").PDFFont;
type PdfColor = import("pdf-lib").RGB;
type PdfImage = import("pdf-lib").PDFImage;

const PAGE = { width: 595.28, height: 841.89, margin: 48 };
type ColorTuple = readonly [number, number, number];
const COLORS: Record<"paper" | "ink" | "muted" | "line" | "card" | "soft" | "rose" | "crimson" | "cyan" | "green" | "amber", ColorTuple> = {
  paper: [0.973, 0.965, 0.945] as const,
  ink: [0.075, 0.086, 0.11] as const,
  muted: [0.38, 0.4, 0.44] as const,
  line: [0.84, 0.82, 0.78] as const,
  card: [1, 1, 1] as const,
  soft: [0.946, 0.938, 0.918] as const,
  rose: [0.992, 0.925, 0.94] as const,
  crimson: [0.929, 0.094, 0.275] as const,
  cyan: [0.025, 0.56, 0.68] as const,
  green: [0.06, 0.55, 0.38] as const,
  amber: [0.82, 0.49, 0.05] as const,
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

class ScriptPdf {
  private page!: PdfPage;
  private y = 0;
  private pages: PdfPage[] = [];
  private readonly lib: PdfLib;
  private readonly doc: PdfDoc;
  private readonly regular: PdfFont;
  private readonly bold: PdfFont;
  private readonly artifactType: string;
  private readonly publisherMark?: PdfImage;
  private readonly productMark?: PdfImage;

  constructor(lib: PdfLib, doc: PdfDoc, regular: PdfFont, bold: PdfFont, artifactType: string, publisherMark?: PdfImage, productMark?: PdfImage) {
    this.lib = lib;
    this.doc = doc;
    this.regular = regular;
    this.bold = bold;
    this.artifactType = artifactType;
    this.publisherMark = publisherMark;
    this.productMark = productMark;
  }

  private color(values: readonly number[]): PdfColor {
    return this.lib.rgb(values[0], values[1], values[2]);
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
        if (font.widthOfTextAtSize(next, size) <= maxWidth || !line) line = next;
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
    this.page.drawRectangle({ x: 0, y: PAGE.height - 3, width: PAGE.width, height: 3, color: this.color(COLORS.crimson) });
    if (this.publisherMark) this.page.drawImage(this.publisherMark, { x: PAGE.margin, y: PAGE.height - 43, width: 23, height: 23 });
    this.page.drawText("PURELY PERSONAL", { x: PAGE.margin + (this.publisherMark ? 31 : 0), y: PAGE.height - 35, size: 7.5, font: this.bold, color: this.color(COLORS.ink) });
    this.page.drawText("PUBLISHER", { x: PAGE.margin + (this.publisherMark ? 31 : 0), y: PAGE.height - 44, size: 5.7, font: this.regular, color: this.color(COLORS.muted) });
    const label = safeText(this.artifactType).toUpperCase();
    const brandWidth = this.bold.widthOfTextAtSize("SECOND BRAIN", 8.5);
    const brandX = PAGE.width - PAGE.margin - brandWidth;
    if (this.productMark) this.page.drawImage(this.productMark, { x: brandX - 27, y: PAGE.height - 45, width: 22, height: 22 });
    this.page.drawText("SECOND BRAIN", { x: brandX, y: PAGE.height - 34, size: 8.5, font: this.bold, color: this.color(COLORS.ink) });
    const labelWidth = this.regular.widthOfTextAtSize(label, 5.8);
    this.page.drawText(label, { x: PAGE.width - PAGE.margin - labelWidth, y: PAGE.height - 44, size: 5.8, font: this.regular, color: this.color(COLORS.crimson) });
    this.page.drawLine({ start: { x: PAGE.margin, y: PAGE.height - 58 }, end: { x: PAGE.width - PAGE.margin, y: PAGE.height - 58 }, thickness: 0.55, color: this.color(COLORS.line) });
    this.y = PAGE.height - 88;
  }

  ensure(height: number) {
    if (!this.page || this.y - height < 55) this.newPage();
  }

  eyebrow(text: string, accent: ColorTuple = COLORS.crimson) {
    this.ensure(20);
    const value = safeText(text).toUpperCase();
    this.page.drawCircle({ x: PAGE.margin + 3, y: this.y + 2.5, size: 2.5, color: this.color(accent) });
    this.page.drawText(value, { x: PAGE.margin + 12, y: this.y, size: 8, font: this.bold, color: this.color(accent) });
    this.y -= 20;
  }

  title(text: string) {
    const clean = safeText(text);
    const size = clean.length > 70 ? 18.5 : clean.length > 48 ? 21 : 24;
    const leading = size * 1.16;
    const lines = this.wrap(clean, this.bold, size, PAGE.width - PAGE.margin * 2 - 12);
    this.ensure(lines.length * leading + 12);
    for (const line of lines) {
      this.page.drawText(line, { x: PAGE.margin, y: this.y, size, font: this.bold, color: this.color(COLORS.ink) });
      this.y -= leading;
    }
    this.y -= 10;
  }

  meta(items: string[]) {
    this.ensure(25);
    let x = PAGE.margin;
    items.forEach((item, index) => {
      const value = safeText(item).toUpperCase();
      if (index) {
        this.page.drawCircle({ x: x + 2, y: this.y + 2.5, size: 1.8, color: this.color(COLORS.crimson) });
        x += 14;
      }
      this.page.drawText(value, { x, y: this.y, size: 7.5, font: this.bold, color: this.color(COLORS.muted) });
      x += this.bold.widthOfTextAtSize(value, 7.5) + 8;
    });
    this.y -= 27;
  }

  section(text: string, accent: ColorTuple = COLORS.ink) {
    this.ensure(30);
    this.y -= 4;
    this.page.drawText(safeText(text).toUpperCase(), { x: PAGE.margin, y: this.y, size: 8, font: this.bold, color: this.color(accent) });
    const labelWidth = this.bold.widthOfTextAtSize(safeText(text).toUpperCase(), 8);
    this.page.drawLine({ start: { x: PAGE.margin + labelWidth + 14, y: this.y + 2 }, end: { x: PAGE.width - PAGE.margin, y: this.y + 2 }, thickness: 0.45, color: this.color(COLORS.line) });
    this.y -= 22;
  }

  paragraph(text: string, options: { size?: number; color?: readonly number[]; indent?: number; leading?: number } = {}) {
    const size = options.size || 10.5;
    const leading = options.leading || size * 1.48;
    const indent = options.indent || 0;
    const lines = this.wrap(text, this.regular, size, PAGE.width - PAGE.margin * 2 - indent);
    for (const line of lines) {
      this.ensure(leading + 2);
      if (line) this.page.drawText(line, { x: PAGE.margin + indent, y: this.y, size, font: this.regular, color: this.color(options.color || COLORS.ink) });
      this.y -= leading;
    }
    this.y -= 5;
  }

  callout(label: string, body: string, accent: ColorTuple = COLORS.crimson) {
    const width = PAGE.width - PAGE.margin * 2 - 34;
    const lines = this.wrap(body, this.regular, 10.8, width);
    const height = 31 + lines.length * 15.5;
    this.ensure(height + 8);
    const bottom = this.y - height + 10;
    this.page.drawRectangle({ x: PAGE.margin, y: bottom, width: PAGE.width - PAGE.margin * 2, height, color: this.color(COLORS.soft) });
    this.page.drawRectangle({ x: PAGE.margin, y: bottom, width: 2.5, height, color: this.color(accent) });
    this.page.drawText(safeText(label).toUpperCase(), { x: PAGE.margin + 17, y: this.y - 8, size: 7, font: this.bold, color: this.color(accent) });
    let lineY = this.y - 27;
    for (const line of lines) {
      this.page.drawText(line, { x: PAGE.margin + 17, y: lineY, size: 10.8, font: this.regular, color: this.color(COLORS.ink) });
      lineY -= 15.5;
    }
    this.y = bottom - 17;
  }

  beat(timecode: string, spoken: string, details: Array<[string, string, readonly number[]]>) {
    this.ensure(92);
    const railX = PAGE.margin + 8;
    this.page.drawCircle({ x: railX, y: this.y + 3, size: 4, color: this.color(COLORS.paper), borderColor: this.color(COLORS.crimson), borderWidth: 1.3 });
    this.page.drawLine({ start: { x: railX, y: this.y - 2 }, end: { x: railX, y: this.y - 70 }, thickness: 0.75, color: this.color(COLORS.line) });
    this.page.drawText(safeText(timecode), { x: PAGE.margin + 24, y: this.y, size: 7.5, font: this.bold, color: this.color(COLORS.crimson) });
    this.y -= 18;
    const spokenLines = this.wrap(spoken, this.regular, 11.2, PAGE.width - PAGE.margin * 2 - 24);
    for (const line of spokenLines) {
      this.ensure(17);
      this.page.drawText(line, { x: PAGE.margin + 24, y: this.y, size: 11.2, font: this.regular, color: this.color(COLORS.ink) });
      this.y -= 16.5;
    }
    this.y -= 6;
    for (const [label, body, accent] of details) {
      this.ensure(23);
      this.page.drawText(safeText(label).toUpperCase(), { x: PAGE.margin + 24, y: this.y, size: 6.5, font: this.bold, color: this.color(accent) });
      const labelWidth = Math.max(48, this.bold.widthOfTextAtSize(safeText(label).toUpperCase(), 7) + 10);
      const lines = this.wrap(body || "None", this.regular, 8.6, PAGE.width - PAGE.margin * 2 - 42 - labelWidth);
      for (const [index, line] of lines.entries()) {
        this.ensure(13);
        this.page.drawText(line, { x: PAGE.margin + 24 + labelWidth, y: this.y - index * 12, size: 8.6, font: this.regular, color: this.color(COLORS.muted) });
      }
      this.y -= Math.max(16, lines.length * 12 + 3);
    }
    this.y -= 10;
  }

  chapter(n: number, timecode: string, title: string, objective: string, script: string, visuals: string[], retention: string) {
    this.ensure(112);
    this.y -= 7;
    const number = String(n).padStart(2, "0");
    this.page.drawText(number, { x: PAGE.margin, y: this.y - 2, size: 24, font: this.bold, color: this.color(COLORS.crimson) });
    this.page.drawText(safeText(timecode), { x: PAGE.margin + 45, y: this.y + 8, size: 7, font: this.bold, color: this.color(COLORS.crimson) });
    this.page.drawText(safeText(title), { x: PAGE.margin + 45, y: this.y - 8, size: 14, font: this.bold, color: this.color(COLORS.ink) });
    this.y -= 38;
    this.page.drawText(safeText(objective), { x: PAGE.margin + 45, y: this.y, size: 8.3, font: this.regular, color: this.color(COLORS.muted) });
    this.y -= 23;
    this.paragraph(script, { size: 10.4, leading: 15.8 });
    const pageBeforeVisuals = this.pages.length;
    this.ensure(visuals.length * 15 + 37);
    if (this.pages.length > pageBeforeVisuals) {
      this.page.drawText(`${number}  /  ${safeText(title).toUpperCase()}  /  CONTINUED`, { x: PAGE.margin, y: this.y, size: 6.5, font: this.bold, color: this.color(COLORS.muted) });
      this.y -= 21;
    }
    this.page.drawText("VISUAL PLAN", { x: PAGE.margin, y: this.y, size: 6.7, font: this.bold, color: this.color(COLORS.cyan) });
    this.y -= 15;
    for (const visual of visuals) {
      this.page.drawCircle({ x: PAGE.margin + 4, y: this.y + 3, size: 1.7, color: this.color(COLORS.cyan) });
      const lines = this.wrap(visual, this.regular, 8.7, PAGE.width - PAGE.margin * 2 - 18);
      for (const line of lines) {
        this.page.drawText(line, { x: PAGE.margin + 14, y: this.y, size: 8.7, font: this.regular, color: this.color(COLORS.muted) });
        this.y -= 12.5;
      }
    }
    this.y -= 5;
    this.ensure(42);
    this.page.drawLine({ start: { x: PAGE.margin, y: this.y + 3 }, end: { x: PAGE.margin + 18, y: this.y + 3 }, thickness: 2, color: this.color(COLORS.amber) });
    this.page.drawText("RETENTION", { x: PAGE.margin + 27, y: this.y, size: 6.5, font: this.bold, color: this.color(COLORS.amber) });
    this.y -= 15;
    this.paragraph(retention, { size: 9.1, indent: 27, color: COLORS.ink, leading: 13 });
    this.page.drawLine({ start: { x: PAGE.margin, y: this.y + 4 }, end: { x: PAGE.width - PAGE.margin, y: this.y + 4 }, thickness: 0.45, color: this.color(COLORS.line) });
    this.y -= 9;
  }

  numberedList(items: string[], accent: ColorTuple = COLORS.crimson) {
    for (const [index, item] of items.entries()) {
      const lines = this.wrap(item, this.regular, 9.7, PAGE.width - PAGE.margin * 2 - 34);
      this.ensure(lines.length * 14 + 12);
      this.page.drawCircle({ x: PAGE.margin + 8, y: this.y + 4, size: 8, color: this.color(COLORS.paper), borderColor: this.color(accent), borderWidth: 0.9 });
      const n = String(index + 1).padStart(2, "0");
      this.page.drawText(n, { x: PAGE.margin + 3.5, y: this.y + 1.5, size: 5.8, font: this.bold, color: this.color(accent) });
      for (const line of lines) {
        this.page.drawText(line, { x: PAGE.margin + 30, y: this.y, size: 9.7, font: this.regular, color: this.color(COLORS.ink) });
        this.y -= 14;
      }
      this.y -= 8;
    }
  }

  finish() {
    const total = this.pages.length;
    this.pages.forEach((page, index) => {
      page.drawLine({ start: { x: PAGE.margin, y: 39 }, end: { x: PAGE.width - PAGE.margin, y: 39 }, thickness: 0.6, color: this.color(COLORS.line) });
      page.drawText("SECOND BRAIN  /  POWERED BY PURELY PERSONAL", { x: PAGE.margin, y: 24, size: 6.5, font: this.bold, color: this.color(COLORS.muted) });
      const pageNo = `${index + 1} / ${total}`;
      const width = this.regular.widthOfTextAtSize(pageNo, 7.2);
      page.drawText(pageNo, { x: PAGE.width - PAGE.margin - width, y: 24, size: 7.2, font: this.regular, color: this.color(COLORS.muted) });
    });
  }
}

async function setup(type: string, publisherMarkBytes?: Uint8Array, productMarkBytes?: Uint8Array) {
  const lib = await import("pdf-lib");
  const doc = await lib.PDFDocument.create();
  doc.setTitle(`Second Brain | ${type}`);
  doc.setAuthor("Purely Personal");
  doc.setCreator("Second Brain");
  doc.setProducer("Second Brain by Purely Personal");
  const regular = await doc.embedFont(lib.StandardFonts.Helvetica);
  const bold = await doc.embedFont(lib.StandardFonts.HelveticaBold);
  let markBytes = publisherMarkBytes;
  if (!markBytes && typeof window !== "undefined") {
    try {
      const response = await fetch("/brand/purely-personal-mark.png");
      if (response.ok) markBytes = new Uint8Array(await response.arrayBuffer());
    } catch { /* PDF remains usable without the publisher mark. */ }
  }
  let iconBytes = productMarkBytes;
  if (!iconBytes && typeof window !== "undefined") {
    try {
      const response = await fetch("/brand/second-brain-icon.png");
      if (response.ok) iconBytes = new Uint8Array(await response.arrayBuffer());
    } catch { /* The text wordmark remains when the icon cannot load. */ }
  }
  const publisherMark = markBytes ? await doc.embedPng(markBytes) : undefined;
  const productMark = iconBytes ? await doc.embedPng(iconBytes) : undefined;
  return { doc, pdf: new ScriptPdf(lib, doc, regular, bold, type, publisherMark, productMark) };
}

export async function createReelScriptPdf(data: ReelArtifactData, publisherMarkBytes?: Uint8Array, productMarkBytes?: Uint8Array): Promise<Uint8Array> {
  const { doc, pdf } = await setup("Reel production script", publisherMarkBytes, productMarkBytes);
  pdf.newPage();
  pdf.eyebrow("Production-ready short-form script");
  pdf.title(data.title);
  pdf.meta([data.platform, `${data.duration_seconds} seconds`, `${data.word_count} words`]);
  pdf.callout("Objective", data.objective, COLORS.cyan);
  pdf.callout("Winning hook", data.hook.spoken, COLORS.crimson);
  pdf.section("Timecoded production script", COLORS.crimson);
  data.beats.forEach((beat) => pdf.beat(beat.timecode, beat.spoken, [
    ["Visual", beat.visual, COLORS.cyan],
    ["On screen", beat.onscreen_text, COLORS.amber],
    ["Edit", beat.edit, COLORS.green],
  ]));
  pdf.section("Publishing package", COLORS.green);
  pdf.callout("CTA", data.cta, COLORS.green);
  pdf.paragraph(data.caption);
  pdf.section("Production direction", COLORS.cyan);
  pdf.callout("Delivery", data.production.delivery, COLORS.crimson);
  pdf.callout("Music", data.production.music, COLORS.cyan);
  pdf.callout("Caption treatment", data.production.captions, COLORS.amber);
  data.production.shot_list.forEach((shot, index) => pdf.paragraph(`${String(index + 1).padStart(2, "0")}  ${shot}`, { size: 9.3, indent: 8, color: COLORS.muted }));
  pdf.finish();
  return doc.save();
}

export async function createLongformScriptPdf(data: LongformArtifactData, publisherMarkBytes?: Uint8Array, productMarkBytes?: Uint8Array): Promise<Uint8Array> {
  const { doc, pdf } = await setup("Long-form video script", publisherMarkBytes, productMarkBytes);
  pdf.newPage();
  pdf.eyebrow("Retention-engineered video script");
  pdf.title(data.title);
  pdf.meta([data.format, `${data.target_minutes} minutes`, `${data.estimated_words} words`]);
  pdf.callout("Click promise", data.click_promise, COLORS.cyan);
  pdf.section("Packaging", COLORS.crimson);
  pdf.callout("Thumbnail text", data.thumbnail.text, COLORS.crimson);
  pdf.paragraph(data.thumbnail.concept, { color: COLORS.muted });
  pdf.section("Payoff map", COLORS.amber);
  pdf.numberedList(data.payoff_map, COLORS.amber);
  pdf.section("Script", COLORS.crimson);
  pdf.callout("0:00 | Click confirmation", data.intro, COLORS.crimson);
  data.chapters.forEach((chapter) => pdf.chapter(chapter.n, chapter.timecode, chapter.title, chapter.objective, chapter.script, chapter.visuals, chapter.retention_device));
  pdf.section("Ending system", COLORS.green);
  pdf.callout("Subscribe line", data.subscribe_line, COLORS.cyan);
  pdf.callout("Final payoff", data.final_payoff, COLORS.green);
  pdf.callout("Watch next bridge", data.watch_next_bridge, COLORS.crimson);
  pdf.section("Production notes", COLORS.cyan);
  data.production_notes.forEach((note, index) => pdf.paragraph(`${String(index + 1).padStart(2, "0")}  ${note}`, { size: 9.3, indent: 8, color: COLORS.muted }));
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
