import type { BrandKit } from "./brand-kit";

/** The structured newsletter the writer produces; rendered into the HTML below. */
export type NewsletterContent = {
  /** small centered eyebrow above the title, e.g. "The Founder's Note" */
  kicker: string;
  subject: string;
  preview: string;
  title: string;
  /** opening paragraphs (blank line between) */
  intro: string;
  /** body supports paragraphs, "- " bullets, "### " subheadings, and **bold** */
  sections: { heading: string; body: string }[];
  /** optional centered pull-quote */
  quote?: string;
  cta: { label: string; url: string };
  signoff: string;
  /** one-line P.S. after the sign-off (playbook step 8: restate the action or add intrigue) */
  ps?: string;
  /** generated image assets (data URLs); optional */
  heroImage?: string;
  inlineImage?: string;
};

const esc = (s: string) =>
  (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

/** The kit's accent colour, resolved the same way the carousel header resolves it. */
export function newsletterAccent(kit: BrandKit | null): string {
  const named = kit?.colors.find((c) => /accent|primary|brand/i.test(c.name) && /^#[0-9A-F]{6}$/i.test(c.hex))?.hex;
  return named || kit?.colors[0]?.hex || "#5B677A";
}

/** Render a body blob into paragraphs, "- " bullet lists, and "### " subheadings.
 *  Line-oriented so a subheading or list can sit directly above body text. */
function renderBody(raw: string): string {
  const out: string[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = () => {
    if (para.length) out.push(`<p class="nl-p">${para.map(inline).join("<br>")}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list.length) out.push(`<ul class="nl-ul">${list.map((l) => `<li>${inline(l)}</li>`).join("")}</ul>`);
    list = [];
  };
  for (const rawLine of (raw || "").replace(/\r/g, "").split("\n")) {
    const l = rawLine.trim();
    if (!l) {
      flushPara();
      flushList();
    } else if (/^#{2,4}\s+/.test(l)) {
      flushPara();
      flushList();
      out.push(`<h3 class="nl-sub">${inline(l.replace(/^#{2,4}\s+/, ""))}</h3>`);
    } else if (/^[-*•]\s+/.test(l)) {
      flushPara();
      list.push(l.replace(/^[-*•]\s+/, ""));
    } else {
      flushList();
      para.push(l);
    }
  }
  flushPara();
  flushList();
  return out.join("");
}

/**
 * Build a complete, self-contained, LIGHT, high-end editorial newsletter email in
 * the founder's brand DNA. ONE solid template — every issue just fills these slots.
 * Responsive (max-width 600px, width 100%) so the preview NEVER scrolls horizontally.
 *
 * Identity comes from the brand kit; an unconfigured kit degrades to the neutral
 * placeholder palette and simply omits the name/tagline rather than inventing one.
 */
export function buildNewsletterHtml(kit: BrandKit | null, c: NewsletterContent): string {
  const accent = newsletterAccent(kit);
  const name = kit?.displayName?.trim() || "";
  const tagline = kit?.tagline?.trim() || "";
  const handle = kit?.handle?.trim() || "";

  const pageBg = "#f4f1ec";
  const card = "#ffffff";
  const ink = "#181a1f";
  const body = "#33373f";
  const muted = "#9a9ca3";
  const line = "#ececec";
  const display = "'Fraunces', Georgia, 'Times New Roman', serif";
  const sans = "'Poppins', 'Helvetica Neue', Arial, sans-serif";

  const hero = c.heroImage
    ? `<tr><td style="padding:30px 0 0;"><img src="${c.heroImage}" alt="" width="600" style="display:block;width:100%;height:auto;border:0;" /></td></tr>`
    : "";

  const sections = c.sections
    .map((s, idx) => {
      const inlineImg =
        idx === 0 && c.inlineImage
          ? `<img src="${c.inlineImage}" alt="" style="display:block;width:100%;height:auto;border:0;border-radius:12px;margin:4px 0 22px;" />`
          : "";
      return `
        <div style="width:30px;height:3px;border-radius:3px;background:${accent};margin:34px 0 14px;"></div>
        <h2 class="nl-h2">${esc(s.heading)}</h2>
        ${inlineImg}
        ${renderBody(s.body)}`;
    })
    .join("");

  const quote = c.quote
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:30px 8px;">
         <p style="margin:0;font-family:${display};font-style:italic;font-weight:500;font-size:21px;line-height:1.45;color:${ink};max-width:440px;">&ldquo;${esc(
        c.quote
      )}&rdquo;</p>
       </td></tr></table>`
    : "";

  // The template supplies the "P.S." label, so drop one the writer added itself
  // rather than rendering "P.S. P.S. …".
  const psText = (c.ps || "").trim().replace(/^p\.?\s*s\.?[:.\s-]*/i, "").trim();
  const ps = psText
    ? `<tr><td class="nl-pad" style="padding:0 56px 32px;text-align:left;">
         <p style="margin:0;font-family:${sans};font-size:14px;line-height:1.66;color:${muted};"><span style="color:${accent};font-weight:600;">P.S.</span> ${esc(
        psText
      )}</p>
       </td></tr>`
    : "";

  const footerIdentity = [name && esc(name), handle && `@${esc(handle.replace(/^@/, ""))}`].filter(Boolean).join(" &middot; ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light only" />
<title>${esc(c.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  body { margin:0; padding:0; background:${pageBg}; overflow-x:hidden; -webkit-font-smoothing:antialiased; }
  img { border:0; outline:none; }
  a { text-decoration:none; }
  .nl-p { margin:0 0 18px; font-family:${sans}; font-size:16px; line-height:1.72; color:${body}; }
  .nl-p strong { color:${ink}; font-weight:600; }
  .nl-sub { margin:24px 0 10px; font-family:${sans}; font-size:14px; font-weight:600; letter-spacing:0.02em; color:${ink}; }
  .nl-h2 { margin:0 0 14px; font-family:${display}; font-weight:600; font-size:23px; line-height:1.28; letter-spacing:-0.01em; color:${ink}; }
  .nl-ul { margin:0 0 20px; padding:0; list-style:none; }
  .nl-ul li { position:relative; padding:0 0 11px 24px; font-family:${sans}; font-size:16px; line-height:1.6; color:${body}; }
  .nl-ul li:before { content:""; position:absolute; left:3px; top:9px; width:7px; height:7px; border-radius:50%; background:${accent}; }
  .nl-ul li strong { color:${ink}; font-weight:600; }
  @media (max-width:620px) {
    .nl-card { width:100% !important; border-radius:0 !important; }
    .nl-pad { padding-left:26px !important; padding-right:26px !important; }
    .nl-title { font-size:30px !important; }
  }
</style>
</head>
<body>
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(c.preview)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${pageBg};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" class="nl-card" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:${card};border-radius:20px;overflow:hidden;box-shadow:0 24px 60px -32px rgba(20,20,30,0.28);">
          <!-- header (centered) -->
          <tr><td class="nl-pad" align="center" style="padding:42px 56px 0;">
            <div style="font-family:${sans};font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.22em;color:${accent};">${esc(
    c.kicker || "The Founder's Note"
  )}</div>
            ${name ? `<div style="margin-top:10px;font-family:${sans};font-size:15px;font-weight:600;color:${ink};">${esc(name)}</div>` : ""}
            ${tagline ? `<div style="margin-top:3px;font-family:${sans};font-size:12px;color:${muted};">${esc(tagline)}</div>` : ""}
            <div style="width:34px;height:1px;background:${line};margin:20px auto 0;"></div>
          </td></tr>
          ${hero}
          <!-- title (centered) -->
          <tr><td class="nl-pad" align="center" style="padding:32px 56px 0;">
            <h1 class="nl-title" style="margin:0;font-family:${display};font-weight:600;font-size:36px;line-height:1.16;letter-spacing:-0.015em;color:${ink};">${esc(
    c.title
  )}</h1>
          </td></tr>
          <!-- intro + sections (left aligned) -->
          <tr><td class="nl-pad" style="padding:24px 56px 0;text-align:left;">
            ${renderBody(c.intro)}
            ${sections}
          </td></tr>
          <!-- pull quote (centered) -->
          <tr><td class="nl-pad" style="padding:0 48px;">${quote}</td></tr>
          <!-- CTA (centered) -->
          <tr><td align="center" style="padding:32px 56px 10px;">
            <table role="presentation" align="center" cellpadding="0" cellspacing="0"><tr>
              <td style="border-radius:999px;background:${accent};">
                <a href="${esc(c.cta.url || "#")}" style="display:inline-block;padding:15px 34px;font-family:${sans};font-size:15px;font-weight:600;color:#ffffff;border-radius:999px;letter-spacing:0.01em;white-space:nowrap;">${esc(
    (c.cta.label || "Read more").trim().slice(0, 30)
  )}</a>
              </td>
            </tr></table>
          </td></tr>
          <!-- signoff (left) -->
          <tr><td class="nl-pad" style="padding:24px 56px 36px;text-align:left;">
            <p style="margin:0;font-family:${display};font-style:italic;font-size:18px;color:${ink};">${esc(
    c.signoff || (name ? `— ${name.split(" ")[0]}` : "—")
  )}</p>
          </td></tr>
          ${ps}
          <!-- footer (centered) -->
          <tr><td align="center" style="border-top:1px solid ${line};padding:24px 40px 30px;">
            <p style="margin:0;font-family:${sans};font-size:12px;line-height:1.7;color:${muted};">
              ${footerIdentity ? `${footerIdentity}<br />` : ""}
              You&rsquo;re receiving this because you subscribed. <a href="#" style="color:${muted};text-decoration:underline;">Unsubscribe</a>.
            </p>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Art-direct a PURPOSE-BUILT premium editorial illustration (not generic stock /
 *  "AI photo" filler). `desc` is the content-specific concept the writer chose. */
export const newsletterImagePrompt = (desc: string, accent: string) =>
  `A premium, purpose-built editorial illustration for a founder's newsletter — ONE strong, intentional idea, designed by a top brand studio, NOT a generic stock image.\n` +
  `CONCEPT (what is literally in the frame, and the idea it conveys): ${desc}.\n` +
  `STYLE: modern editorial vector illustration with subtle dimensional shading and a fine paper grain; bold, simple, confident shapes; ONE clear focal subject; deliberate composition with generous negative space and intentional use of scale.\n` +
  `PALETTE: warm off-white / cream background, soft warm neutrals, and ${accent} as the SINGLE bold accent. Light, airy, high-key, calm, expensive.\n` +
  `STRICTLY AVOID: photographic stock look, corporate clip-art, smiling business people, hands pointing at floating charts, glossy 3D chrome spheres, random gradient blobs, neon, lens flares, busy clutter — and absolutely NO text, words, letters, numbers, logos, watermarks, or fake UI.`;
