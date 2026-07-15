import guideRows from "../../content/guides/content-guides.json";
import videoGuideRows from "../../content/guides/video-script-guides.json";

export type ContentGuide = {
  key: string;
  title: string;
  category: string;
  variant: string | null;
  isNew: boolean;
  body: string;
  similarity: number;
};

type StoredGuide = {
  key: string;
  title: string;
  category: string;
  variant: string | null;
  is_new: boolean;
  body: string;
};

const GUIDES = [...guideRows, ...videoGuideRows] as StoredGuide[];

const FORMAT_CATEGORIES: Record<string, string[]> = {
  carousel: ["carousel", "cheatsheet"],
  picture: ["carousel", "cheatsheet", "text"],
  text: ["text"],
  newsletter: ["newsletter"],
  reels: ["reels"],
  longform: ["longform"],
  profile: ["profile"],
  strategy: ["strategy"],
  description: ["description"],
};

function variantHint(task: string): string | null {
  const text = task.toLowerCase().replace(/[’‘]/g, "'").replace(/[–—]/g, "-");
  if (/do'?s and don'?ts|dos and donts|do and don|don'?ts/.test(text)) return "dos-donts";
  if (/\bvs\b|versus|compare|comparison/.test(text)) return "vs";
  if (/\blisticle|list of|top \d|\d+ (ways|tips|reasons|lessons|mistakes|steps|tools)/.test(text)) return "listicle";
  if (/\bintent\b/.test(text)) return "intent";
  return null;
}

function preferredKey(format: string, task: string): string | null {
  const hint = variantHint(task);
  if (format === "carousel" || format === "picture") {
    if (hint === "dos-donts") return "cheatsheet-do-s-and-don-ts";
    if (hint === "vs") return "new-cheatsheet-vs";
    if (hint === "listicle") return "new-cheatsheet-listicles";
    if (hint === "intent") return "intent-carousel-prompt";
    return "new-carousel-prompt";
  }
  if (format === "text") {
    const text = task.toLowerCase();
    if (/story|personal|journey|vulnerab|turning point|lesson i learned/.test(text)) return "new-text-2";
    if (/framework|playbook|steps|how to|tactical|checklist|list/.test(text)) return "new-text-1";
    return "new-text";
  }
  if (format === "newsletter") return "new-newsletter-prompt";
  if (format === "reels") return "reels-master-playbook";
  if (format === "longform") return "longform-video-master-playbook";
  if (format === "strategy") return "content-strategy-prompt";
  if (format === "description") return "content-description-prompt";
  if (format === "profile") return "profile-optimization";
  return null;
}

function terms(task: string): string[] {
  return [...new Set(task.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 3))];
}

/**
 * Local production-safe retrieval. The original embeddings selected one of only
 * 17 full documents; deterministic intent/variant routing is more reliable for
 * this small, known corpus and needs no external vector database.
 */
export async function getContentGuide(opts: { format: string; task: string }): Promise<ContentGuide | null> {
  const allowed = FORMAT_CATEGORIES[opts.format] || [];
  if (!allowed.length) return null;
  const exact = preferredKey(opts.format, opts.task);
  const query = terms(opts.task);
  const candidates = GUIDES.filter((guide) => allowed.includes(guide.category));
  const ranked = candidates.map((guide) => {
    const haystack = `${guide.key} ${guide.title} ${guide.category} ${guide.variant || ""} ${guide.body}`.toLowerCase();
    let score = guide.is_new ? 0.12 : 0;
    if (guide.key === exact) score += 10;
    if (variantHint(opts.task) && guide.variant === variantHint(opts.task)) score += 2;
    for (const term of query) if (haystack.includes(term)) score += 0.01;
    return { guide, score };
  }).sort((a, b) => b.score - a.score);
  const selected = ranked[0];
  if (!selected) return null;
  return {
    key: selected.guide.key,
    title: selected.guide.title,
    category: selected.guide.category,
    variant: selected.guide.variant,
    isNew: selected.guide.is_new,
    body: selected.guide.body,
    similarity: selected.score,
  };
}

export async function getGuideByCategory(category: string, task = category) {
  return getContentGuide({ format: category, task });
}

export function listContentGuides(): Omit<ContentGuide, "body" | "similarity">[] {
  return GUIDES.map((guide) => ({ key: guide.key, title: guide.title, category: guide.category, variant: guide.variant, isNew: guide.is_new }));
}
