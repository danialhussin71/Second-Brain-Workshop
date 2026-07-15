/**
 * Marketing OS — the org chart. The CEO sits at the top and reads every
 * document. It never does the work itself: it routes each instruction to the CMO,
 * who fires the right specialist sub-agents. Content is itself a small team: it
 * picks a FORMAT (text / picture / carousel / reels / long-form / newsletter) and
 * the matching producer writes it. The user only ever talks to the CEO.
 *
 * SCOPE: this build is marketing-only. The org is CEO -> CMO, plus Research as a
 * shared specialist reporting to the CEO. There is deliberately no COO / CTO /
 * CRO — every instruction lands on the CMO.
 *
 * This is the static topology + the routing brain's option space. The live run
 * (`/api/jarvis/run`) walks this tree and emits jarvis-events as it goes.
 */

import type { JarvisNodeId, RouteAssignment } from "./jarvis-events";

export type OrgKind = "ceo" | "department" | "specialist" | "format";

export type OrgNode = {
  id: JarvisNodeId;
  kind: OrgKind;
  /** Short codename shown on the node ("CEO", "CMO", "Research", "Carousel"). */
  title: string;
  /** The human role ("Reads every document", "Marketing", "Text posts"). */
  label: string;
  color: string;
  /** Phosphor icon name, resolved on the client. */
  icon: string;
  parent: JarvisNodeId | null;
  /** For producers: which GTM agent config + knowledge scope it borrows. */
  agentKey?: string;
};

export const CEO_ID: JarvisNodeId = "kronos";

export const ORG: Record<JarvisNodeId, OrgNode> = {
  kronos: {
    id: "kronos",
    kind: "ceo",
    title: "CEO",
    label: "Reads every document",
    color: "#22d3ee",
    icon: "Brain",
    parent: null,
  },

  /* ---- department head (marketing-only build: the CMO is the whole C-suite) ---- */
  cmo: { id: "cmo", kind: "department", title: "CMO", label: "Marketing", color: "#a78bfa", icon: "Megaphone", parent: "kronos" },

  /* ---- specialists ---- */
  // Research is a SHARED specialist: it reports to the CEO, not to the CMO, and
  // runs once up front for a market/angle read before the content team writes.
  research: { id: "research", kind: "specialist", title: "Research", label: "Trends & angles", color: "#22d3ee", icon: "Binoculars", parent: "kronos", agentKey: "research" },
  content: { id: "content", kind: "specialist", title: "Content", label: "Posts in your voice", color: "#a78bfa", icon: "PenNib", parent: "cmo", agentKey: "content" },

  /* ---- content formats (under Content) ---- */
  text: { id: "text", kind: "format", title: "Text", label: "Text posts", color: "#a78bfa", icon: "Article", parent: "content", agentKey: "content" },
  picture: { id: "picture", kind: "format", title: "Picture", label: "Single-image posts", color: "#c084fc", icon: "Image", parent: "content", agentKey: "content" },
  carousel: { id: "carousel", kind: "format", title: "Carousel", label: "Swipe-through decks", color: "#d946ef", icon: "Cards", parent: "content", agentKey: "content" },
  reels: { id: "reels", kind: "format", title: "Reels", label: "Short-form scripts", color: "#f472b6", icon: "VideoCamera", parent: "content", agentKey: "content" },
  longform: { id: "longform", kind: "format", title: "Long-form", label: "Long-form scripts", color: "#818cf8", icon: "FilmSlate", parent: "content", agentKey: "content" },
  newsletter: { id: "newsletter", kind: "format", title: "Newsletter", label: "Email newsletters", color: "#fb7185", icon: "EnvelopeSimple", parent: "content", agentKey: "content" },
};

export const ALL_NODES: OrgNode[] = Object.values(ORG);
export const DEPARTMENTS: OrgNode[] = ALL_NODES.filter((n) => n.kind === "department");

export const FORMAT_IDS: JarvisNodeId[] = ["text", "picture", "carousel", "reels", "longform", "newsletter"];
export function isFormat(id: JarvisNodeId): boolean {
  return FORMAT_IDS.includes(id);
}

/**
 * Shared specialists are not owned by a department — the CEO fires them once for
 * the whole team before delegating. Research is the only one.
 */
export const SHARED_SPECIALISTS: JarvisNodeId[] = ["research"];
export function isShared(id: JarvisNodeId): boolean {
  return SHARED_SPECIALISTS.includes(id);
}

export function node(id: JarvisNodeId): OrgNode {
  return ORG[id];
}

/** Direct children of a node (the CMO under the CEO, specialists under a dept, formats under Content). */
export function childrenOf(id: JarvisNodeId): OrgNode[] {
  return ALL_NODES.filter((n) => n.parent === id);
}

/** Producing leaves in a node's subtree (nodes that actually do work). */
export function leavesOf(id: JarvisNodeId): JarvisNodeId[] {
  const kids = childrenOf(id);
  if (kids.length === 0) return [id];
  return kids.flatMap((k) => leavesOf(k.id));
}

/** Chain from a node up to (and excluding) the CEO: [self, ...ancestors-below-ceo]. */
export function chainToCeo(id: JarvisNodeId): JarvisNodeId[] {
  const out: JarvisNodeId[] = [id];
  let cur = node(id).parent;
  while (cur && cur !== "kronos") {
    out.push(cur);
    cur = node(cur).parent;
  }
  return out;
}

/* --------------------------- routing --------------------------- */

export type TeamPlan = {
  /** one entry per department head assigned — marketing-only, so always the CMO */
  assignments: RouteAssignment[];
  /** shared specialists (e.g. research) that run ONCE first for the whole team */
  shared: JarvisNodeId[];
  rationale: string;
};

/**
 * Deterministic fallback when the CEO planner is unavailable. Knowledge questions
 * go to Research only; strategy goes to the CMO; explicit production asks wake
 * Content and the requested format.
 */
export function keywordRoute(instruction: string): TeamPlan {
  const t = instruction.toLowerCase();
  const has = (...words: string[]) => words.some((w) => t.includes(w));

  let format: JarvisNodeId | null = null;
  if (has("newsletter", "email newsletter", "broadcast", "email blast", "email campaign", "weekly email")) format = "newsletter";
  else if (has("carousel", "slides", "slide deck", "swipe", "cheatsheet", "cheat sheet", "listicle")) format = "carousel";
  else if (has("picture", "image post", "graphic", "single image")) format = "picture";
  else if (has("reel", "short form", "short-form", "tiktok")) format = "reels";
  else if (has("long form", "long-form", "youtube", "video script", "vsl")) format = "longform";
  else if (has("text post", "linkedin post", "tweet", "thread", "write a post", "draft a post")) format = "text";

  const asksStrategy = has("strategy", "campaign", "positioning", "messaging", "launch plan", "marketing plan", "go to market", "gtm");
  const asksKnowledge = /^(what|who|why|how|where|when|tell me|summari[sz]e|explain|find|show me|do i|does my|is my)\b/.test(t) || has("my icp", "my audience", "my offer", "brand voice", "second brain");

  if (!format && asksKnowledge && !asksStrategy) {
    return { assignments: [], shared: ["research"], rationale: "Research reads the relevant knowledge and reports directly to the CEO." };
  }

  if (!format) {
    return { assignments: [{ department: "cmo", plan: [] }], shared: ["research"], rationale: "The CMO turns the research into a marketing decision and action plan." };
  }

  return {
    assignments: [{ department: "cmo", plan: [format] }],
    shared: ["research"],
    rationale: `Research sharpens the angle, then Content produces the ${node(format).title.toLowerCase()}.`,
  };
}

/** The valid option space handed to the LLM router (so it can only pick real producing leaves). */
export const ROUTER_OPTIONS = {
  departments: DEPARTMENTS.map((d) => ({ id: d.id, label: d.label, produces: leavesOf(d.id) })),
  shared: SHARED_SPECIALISTS.map((id) => ({ id, label: node(id).label })),
};
