import { openAIJson } from "@/lib/openai-responses";
import { listOwnerNotes, type OwnerNote } from "@/lib/owner-knowledge";
import { getContentGuide } from "@/lib/content-guides";
import { keywordRoute, node, type TeamPlan } from "@/lib/org";
import {
  encodeEvent,
  type CarouselArtifactData,
  type JarvisEvent,
  type JarvisNodeId,
  type LongformArtifactData,
  type PicturePostArtifactData,
  type ReelArtifactData,
  type TextPostArtifactData,
} from "@/lib/jarvis-events";
import { RICH_RESPONSE_SCHEMA, type RichResponse } from "@/lib/rich-response";
import { brandKitContext, getBrandKit } from "@/lib/brand-kit";
import { STYLE_PRESETS } from "@/lib/post-image";
import { isRecallQuery, isSessionNote, recordSession } from "@/lib/session-memory";

export const runtime = "nodejs";
export const maxDuration = 300;

type ContentFormat = "text" | "picture" | "carousel" | "reels" | "longform" | "newsletter";
type PlannerResult = {
  intent: "knowledge_answer" | "marketing_strategy" | "content_creation";
  rationale: string;
  use_research: boolean;
  use_cmo: boolean;
  formats: ContentFormat[];
};

type Contribution = {
  agent: JarvisNodeId;
  title: string;
  summary: string;
  output: string;
  source_titles: string[];
};

type Emit = (event: JarvisEvent) => void;
const now = () => Date.now();
const beat = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

const PLANNER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["intent", "rationale", "use_research", "use_cmo", "formats"],
  properties: {
    intent: { type: "string", enum: ["knowledge_answer", "marketing_strategy", "content_creation"] },
    rationale: { type: "string" },
    use_research: { type: "boolean" },
    use_cmo: { type: "boolean" },
    formats: {
      type: "array",
      uniqueItems: true,
      maxItems: 4,
      items: { type: "string", enum: ["text", "picture", "carousel", "reels", "longform", "newsletter"] },
    },
  },
} as const;

const CONTRIBUTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "output", "source_titles"],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    output: { type: "string" },
    source_titles: { type: "array", items: { type: "string" } },
  },
} as const;

const CAROUSEL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["topic", "hook", "slides", "caption", "styleBible", "grounding"],
  properties: {
    topic: { type: "string" },
    hook: { type: "string" },
    caption: { type: "string" },
    styleBible: { type: "string" },
    grounding: { type: "array", items: { type: "string" } },
    slides: {
      type: "array",
      minItems: 3,
      maxItems: 15,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["n", "kind", "title", "body", "layout", "visual", "logos"],
        properties: {
          n: { type: "integer" },
          kind: { type: "string", enum: ["hook", "body", "cta"] },
          title: { type: "string" },
          body: { type: "string" },
          layout: { type: "string", enum: ["split", "stacked", "statement"] },
          visual: { type: "string" },
          logos: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

const REEL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "platform", "objective", "duration_seconds", "word_count", "hook", "beats", "cta", "caption", "production", "grounding"],
  properties: {
    title: { type: "string" },
    platform: { type: "string", enum: ["Instagram Reels", "TikTok", "YouTube Shorts", "LinkedIn video"] },
    objective: { type: "string" },
    duration_seconds: { type: "integer" },
    word_count: { type: "integer" },
    hook: {
      type: "object",
      additionalProperties: false,
      required: ["spoken", "visual", "onscreen_text"],
      properties: {
        spoken: { type: "string" },
        visual: { type: "string" },
        onscreen_text: { type: "string" },
      },
    },
    beats: {
      type: "array",
      minItems: 3,
      maxItems: 16,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["timecode", "duration_seconds", "spoken", "visual", "onscreen_text", "edit"],
        properties: {
          timecode: { type: "string" },
          duration_seconds: { type: "integer" },
          spoken: { type: "string" },
          visual: { type: "string" },
          onscreen_text: { type: "string" },
          edit: { type: "string" },
        },
      },
    },
    cta: { type: "string" },
    caption: { type: "string" },
    production: {
      type: "object",
      additionalProperties: false,
      required: ["delivery", "music", "captions", "shot_list"],
      properties: {
        delivery: { type: "string" },
        music: { type: "string" },
        captions: { type: "string" },
        shot_list: { type: "array", items: { type: "string" } },
      },
    },
    grounding: { type: "array", items: { type: "string" } },
  },
} as const;

const LONGFORM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "format", "target_minutes", "estimated_words", "click_promise", "thumbnail", "intro", "payoff_map", "chapters", "subscribe_line", "final_payoff", "watch_next_bridge", "production_notes", "grounding"],
  properties: {
    title: { type: "string" },
    format: { type: "string", enum: ["YouTube video", "Video essay", "Tutorial", "Case study", "Documentary", "Talking head", "VSL"] },
    target_minutes: { type: "number" },
    estimated_words: { type: "integer" },
    click_promise: { type: "string" },
    thumbnail: {
      type: "object",
      additionalProperties: false,
      required: ["concept", "text"],
      properties: { concept: { type: "string" }, text: { type: "string" } },
    },
    intro: { type: "string" },
    payoff_map: { type: "array", items: { type: "string" } },
    chapters: {
      type: "array",
      minItems: 3,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["n", "timecode", "title", "objective", "script", "visuals", "retention_device"],
        properties: {
          n: { type: "integer" },
          timecode: { type: "string" },
          title: { type: "string" },
          objective: { type: "string" },
          script: { type: "string" },
          visuals: { type: "array", items: { type: "string" } },
          retention_device: { type: "string" },
        },
      },
    },
    subscribe_line: { type: "string" },
    final_payoff: { type: "string" },
    watch_next_bridge: { type: "string" },
    production_notes: { type: "array", items: { type: "string" } },
    grounding: { type: "array", items: { type: "string" } },
  },
} as const;

const TEXTPOST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["platform", "angle", "hook", "body", "cta", "hashtags", "alt_hooks", "grounding"],
  properties: {
    platform: { type: "string", enum: ["LinkedIn", "X", "Instagram", "Threads", "Facebook"] },
    angle: { type: "string", enum: ["standard", "story", "framework", "contrarian"] },
    hook: { type: "string" },
    body: { type: "string" },
    cta: { type: "string" },
    hashtags: { type: "array", items: { type: "string" }, maxItems: 6 },
    alt_hooks: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 3 },
    grounding: { type: "array", items: { type: "string" } },
  },
} as const;

const PICTUREPOST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["platform", "aspect", "style", "concept", "image_prompt", "on_image_text", "caption", "cta", "hashtags", "grounding"],
  properties: {
    platform: { type: "string", enum: ["Instagram", "LinkedIn", "Facebook", "X"] },
    aspect: { type: "string", enum: ["square", "portrait", "landscape"] },
    style: { type: "string", enum: Object.keys(STYLE_PRESETS) },
    concept: { type: "string" },
    image_prompt: { type: "string" },
    on_image_text: { type: "string" },
    caption: { type: "string" },
    cta: { type: "string" },
    hashtags: { type: "array", items: { type: "string" }, maxItems: 6 },
    grounding: { type: "array", items: { type: "string" } },
  },
} as const;

function carouselSchema(slideCount: number) {
  return {
    ...CAROUSEL_SCHEMA,
    properties: {
      ...CAROUSEL_SCHEMA.properties,
      slides: { ...CAROUSEL_SCHEMA.properties.slides, minItems: slideCount, maxItems: slideCount },
    },
  };
}

/**
 * Does the instruction ask to CREATE something new (vs. recall past work)?
 * Past-tense references ("the carousel you made") are stripped first so they
 * don't read as a fresh creation directive.
 */
function wantsNewDeliverable(instruction: string): boolean {
  const withoutPast = instruction.replace(/\b(made|wrote|created|built|generated|designed|produced|drafted|did)\b/gi, "");
  return /\b(write|create|make|generate|draft|design|produce|build|compose|craft|give me|turn (?:this|that|it) into|another|a new|new (?:one|version)|similar)\b/i.test(withoutPast);
}

function cleanPlan(plan: PlannerResult, instruction: string): TeamPlan {
  const validFormats = [...new Set(plan.formats)].filter((id): id is ContentFormat =>
    ["text", "picture", "carousel", "reels", "longform", "newsletter"].includes(id)
  );
  // A recall question ("remember when you did X?") must be answered from the
  // session log, never regenerate a fresh deliverable — unless the founder also
  // explicitly asks to create something new in the same breath. The planner LLM
  // gets pulled toward content_creation by format words ("the carousel"), so
  // enforce this deterministically.
  if (isRecallQuery(instruction) && !wantsNewDeliverable(instruction)) {
    return { assignments: [], shared: ["research"], rationale: "Recalling this from the session log." };
  }
  if (plan.intent === "knowledge_answer") {
    return { assignments: [], shared: ["research"], rationale: plan.rationale };
  }
  if (plan.intent === "content_creation" && validFormats.length) {
    return {
      assignments: [{ department: "cmo", plan: validFormats }],
      shared: plan.use_research ? ["research"] : [],
      rationale: plan.rationale,
    };
  }
  if (plan.use_cmo || plan.intent === "marketing_strategy") {
    return {
      assignments: [{ department: "cmo", plan: validFormats }],
      shared: plan.use_research ? ["research"] : [],
      rationale: plan.rationale,
    };
  }
  return keywordRoute(instruction);
}

async function planWithCeo(instruction: string, signal: AbortSignal): Promise<TeamPlan> {
  // Recall short-circuit: answer from the session log before the LLM (or the
  // keyword fallback) can be pulled into regenerating a deliverable.
  if (isRecallQuery(instruction) && !wantsNewDeliverable(instruction)) {
    return { assignments: [], shared: ["research"], rationale: "Recalling this from the session log." };
  }
  try {
    const plan = await openAIJson<PlannerResult>({
      name: "marketing_team_plan",
      schema: PLANNER_SCHEMA,
      signal,
      maxOutputTokens: 4000,
      instructions:
        "You are the CEO router for a MARKETING-ONLY AI team. You delegate, never answer the request yourself. " +
        "The only workers are: Research (reads the uploaded second brain and answers knowledge/analysis questions), " +
        "CMO (marketing strategy and decisions), Content (a coordinator automatically used for production), and format producers: " +
        "text, picture, carousel, reels, longform, newsletter. Route only to agents that genuinely need to work. " +
        "The second brain also holds a running log of past sessions (what the team did in previous chats). " +
        "A recall or memory question ('remember when you did X', 'what did we do last time', 'the session where we made the carousel') is knowledge_answer: Research reads the session log, no CMO and no content format. " +
        "A question such as 'what is my ICP?' is knowledge_answer: Research only, no CMO and no content format. " +
        "A strategy, positioning, campaign, or launch decision is marketing_strategy: Research plus CMO, with formats empty unless a deliverable is explicitly requested. " +
        "A request to write or create content is content_creation: choose the exact requested format(s), use CMO, and use Research when brain context, audience, voice, or angle improves the work. " +
        "Never default an ordinary question to a text post. Keep rationale to one plain-English sentence.",
      input: `Instruction: ${instruction}`,
    });
    return cleanPlan(plan, instruction);
  } catch {
    return keywordRoute(instruction);
  }
}

function queryTerms(input: string): string[] {
  return [...new Set(input.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2))];
}

function selectKnowledge(notes: OwnerNote[], instruction: string, limit = 10): OwnerNote[] {
  const terms = queryTerms(instruction);
  const recall = isRecallQuery(instruction);
  return notes
    .map((note) => {
      const title = note.title.toLowerCase();
      const haystack = `${note.title}\n${note.path}\n${note.body}`.toLowerCase();
      let score = /brand|voice|position|icp|audience|offer/i.test(note.title) ? 2 : 0;
      // The session log is what the founder means by "remember when you did X",
      // so surface it for recall queries and keep it out of the way otherwise.
      if (isSessionNote(note)) score += recall ? 9 : -1.5;
      for (const term of terms) score += (title.includes(term) ? 6 : 0) + (haystack.includes(term) ? 1 : 0);
      return { note, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(limit, notes.length))
    .map(({ note }) => note);
}

function knowledgeText(notes: OwnerNote[]): string {
  if (!notes.length) return "No second-brain documents have been uploaded.";
  return notes.map((note) => `## ${note.title}\nPath: ${note.path}\n${note.body}`).join("\n\n").slice(0, 120000);
}

async function runResearch(instruction: string, notes: OwnerNote[], emit: Emit, signal: AbortSignal): Promise<Contribution> {
  emit({ type: "agent.activate", node: "research", label: "Research is reading the relevant knowledge", at: now() });
  emit({ type: "agent.status", node: "research", status: "Finding the right notes and connections", at: now() });
  for (const note of notes) {
    emit({ type: "agent.tool", node: "research", tool: "Second Brain", detail: note.title, at: now() });
  }
  const result = await openAIJson<Omit<Contribution, "agent">>({
    name: "research_handoff",
    schema: CONTRIBUTION_SCHEMA,
    signal,
    maxOutputTokens: 10000,
    instructions:
      "You are the Research specialist in a marketing team. Answer the research portion of the instruction from the supplied second-brain notes. " +
      "The notes may include a log of past sessions (titles begin with 'Session —'). If the founder is recalling something the team did before ('remember when you did X'), answer from those session notes and state when it happened. " +
      "Separate source-backed facts from reasonable inference. Be concrete. source_titles may contain only exact supplied note titles. " +
      "Your output is an internal handoff to the CEO or CMO, not generic advice.",
    input: `Instruction:\n${instruction}\n\nSECOND BRAIN:\n${knowledgeText(notes)}`,
  });
  emit({ type: "agent.output", node: "research", summary: result.summary, at: now() });
  emit({ type: "agent.report", from: "research", to: "kronos", summary: "Research brief delivered", at: now() });
  return { agent: "research", ...result };
}

async function runCmo(
  instruction: string,
  notes: OwnerNote[],
  research: Contribution | undefined,
  emit: Emit,
  signal: AbortSignal
): Promise<Contribution> {
  emit({ type: "agent.activate", node: "cmo", label: "CMO is making the marketing decision", at: now() });
  emit({ type: "agent.status", node: "cmo", status: "Turning context into a focused strategy", at: now() });
  const guide = await getContentGuide({ format: "strategy", task: instruction });
  if (guide) emit({ type: "agent.tool", node: "cmo", tool: "Content guide", detail: guide.title, at: now() });
  const result = await openAIJson<Omit<Contribution, "agent">>({
    name: "cmo_strategy",
    schema: CONTRIBUTION_SCHEMA,
    signal,
    maxOutputTokens: 12000,
    instructions:
      "You are the CMO. Produce the strategic marketing work requested. Use the research handoff and second-brain context. " +
      "Make decisions, explain tradeoffs, and give a concrete plan. Do not pretend another specialist ran. source_titles may contain only exact supplied note titles.\n\n" +
      (guide ? `AUTHORITATIVE STRATEGY PLAYBOOK — follow it closely:\n${guide.body}` : ""),
    input: `Instruction:\n${instruction}\n\nRESEARCH HANDOFF:\n${research?.output || "No separate research run."}\n\nSECOND BRAIN:\n${knowledgeText(notes)}`,
  });
  emit({ type: "agent.output", node: "cmo", summary: result.summary, at: now() });
  emit({ type: "agent.report", from: "cmo", to: "kronos", summary: "Marketing strategy delivered", at: now() });
  return { agent: "cmo", ...result };
}

const FORMAT_BRIEF: Record<ContentFormat, string> = {
  text: "Write the finished text post or thread, including the exact hook and body.",
  picture: "Write the finished single-image post: image concept, on-image copy, caption, and CTA.",
  carousel: "Write the finished carousel slide by slide, with a hook slide, logical body sequence, CTA slide, and caption.",
  reels: "Write the finished short-form video script with hook, spoken beats, visual directions, and CTA.",
  longform: "Write the finished long-form video or VSL script with structure, transitions, proof, and CTA.",
  newsletter: "Write the finished email newsletter with subject, preview text, complete body, and CTA.",
};

function requestedSlideCount(instruction: string): number {
  const match = instruction.toLowerCase().match(/(?:carousel|deck|cheatsheet)(?:\s+(?:of|with|in))?\s+(\d{1,2})|(?:\b)(\d{1,2})[- ]slide/);
  return Math.max(3, Math.min(15, Number(match?.[1] || match?.[2] || 7)));
}

function requestedReelDuration(instruction: string): number {
  const match = instruction.toLowerCase().match(/\b(15|30|45|60|90)\s*(?:seconds?|secs?|s)\b/);
  return Number(match?.[1] || 60);
}

function requestedLongformMinutes(instruction: string): number {
  const match = instruction.toLowerCase().match(/\b(\d{1,2})\s*(?:minutes?|mins?|min)\b/);
  return Math.max(3, Math.min(30, Number(match?.[1] || 10)));
}

async function runCarousel(
  instruction: string,
  notes: OwnerNote[],
  research: Contribution | undefined,
  emit: Emit,
  signal: AbortSignal
): Promise<Contribution> {
  emit({ type: "agent.activate", node: "carousel", label: "Carousel producer is online", at: now() });
  emit({ type: "agent.status", node: "carousel", status: "Selecting the right carousel playbook", at: now() });
  const guide = await getContentGuide({ format: "carousel", task: `${instruction}\n${research?.output || ""}` });
  if (guide) emit({ type: "agent.tool", node: "carousel", tool: "Content guide", detail: guide.title, at: now() });
  emit({ type: "agent.tool", node: "carousel", tool: "Voice DNA", detail: "Uploaded brand and knowledge notes", at: now() });
  const slideCount = requestedSlideCount(instruction);
  emit({ type: "agent.status", node: "carousel", status: `Writing and art-directing ${slideCount} slides`, at: now() });
  const artifact = await openAIJson<CarouselArtifactData>({
    name: "carousel_artifact",
    schema: carouselSchema(slideCount),
    signal,
    maxOutputTokens: 20000,
    instructions:
      "You are the founder's senior LinkedIn carousel strategist and art director. Return a finished, ready-to-render deck. " +
      `Produce EXACTLY ${slideCount} slides. Slide 1 is kind hook. The last slide is kind cta. Every middle slide is kind body. ` +
      "Keep slide copy concise enough to read on a phone. Build one coherent narrative with strong transitions, not disconnected tips. " +
      "Match the founder's documented voice. Never invent facts, quotes, client stories, or metrics. " +
      "For every slide, provide concrete visual direction that GPT Image 2 can execute. Choose split, stacked, or statement intentionally and vary layouts. " +
      "When a real product is central, include its exact official brand name in logos; otherwise use an empty array. " +
      // No header/profile rules here: the app overlays its own locked identity
      // header onto a reserved top strip, so anything the art director says
      // about one only fights that reservation at render time.
      "styleBible must be a reusable visual system derived from the uploaded brand guidance: palette, typography character, spacing, image treatment, and consistency rules. " +
      "Never describe an identity header, profile row, avatar, name plate, repost mark, or anything else occupying the top of the slide — that strip is reserved and rendered separately. " +
      "grounding may contain only exact titles of supplied second-brain notes.\n\n" +
      (guide ? `AUTHORITATIVE CAROUSEL/CHEATSHEET PLAYBOOK — follow every applicable rule:\n${guide.body}` : ""),
    input: `Founder instruction:\n${instruction}\n\nRESEARCH HANDOFF:\n${research?.output || "No separate research run."}\n\nSECOND BRAIN, VOICE, AND BRAND CONTEXT:\n${knowledgeText(notes)}`,
  });
  artifact.slides = artifact.slides.map((slide, index) => ({
    ...slide,
    n: index + 1,
    kind: index === 0 ? "hook" : index === slideCount - 1 ? "cta" : "body",
  }));
  emit({ type: "artifact", kind: "carousel", data: artifact, at: now() });
  emit({ type: "agent.output", node: "carousel", summary: `${artifact.slides.length} slides on “${artifact.topic}”`, at: now() });
  emit({ type: "agent.report", from: "carousel", to: "content", summary: "Carousel copy and art direction delivered", at: now() });
  return {
    agent: "carousel",
    title: artifact.topic,
    summary: `${artifact.slides.length}-slide carousel ready`,
    output: artifact.slides.map((slide) => `Slide ${slide.n} — ${slide.title}\n${slide.body}`).join("\n\n") + `\n\nCaption:\n${artifact.caption}`,
    source_titles: artifact.grounding,
  };
}

async function runReel(
  instruction: string,
  notes: OwnerNote[],
  research: Contribution | undefined,
  emit: Emit,
  signal: AbortSignal
): Promise<Contribution> {
  emit({ type: "agent.activate", node: "reels", label: "Reel script producer is online", at: now() });
  emit({ type: "agent.status", node: "reels", status: "Auditioning hooks and mapping retention beats", at: now() });
  const guide = await getContentGuide({ format: "reels", task: `${instruction}\n${research?.output || ""}` });
  if (guide) emit({ type: "agent.tool", node: "reels", tool: "Content guide", detail: guide.title, at: now() });
  emit({ type: "agent.tool", node: "reels", tool: "Voice DNA", detail: "Uploaded brand and knowledge notes", at: now() });
  const duration = requestedReelDuration(instruction);
  const artifact = await openAIJson<ReelArtifactData>({
    name: "reel_production_script",
    schema: REEL_SCHEMA,
    signal,
    maxOutputTokens: 16000,
    instructions:
      "You are the founder's senior short-form video strategist, scriptwriter, and editor. Return a finished production script, never an outline. " +
      `The requested runtime is exactly ${duration} seconds. Keep the total spoken copy inside the guide's word budget and set duration_seconds to ${duration}. ` +
      "Silently audition five hook directions before selecting one. The hook object is the metadata summary of the first beat: hook.spoken must exactly match beats[0].spoken, and its visual and on-screen text must exactly match the first beat too. " +
      "Give every beat a real timecode, spoken copy, a feasible visual, additive on-screen text, and an edit instruction. Ensure beat durations cover the runtime. " +
      "Use only factual claims supported by supplied context. grounding may contain only exact titles of supplied notes.\n\n" +
      (guide ? `AUTHORITATIVE REEL PLAYBOOK, follow every applicable rule:\n${guide.body}` : ""),
    input: `Founder instruction:\n${instruction}\n\nRESEARCH HANDOFF:\n${research?.output || "No separate research run."}\n\nSECOND BRAIN, VOICE, AND BRAND CONTEXT:\n${knowledgeText(notes)}`,
  });
  artifact.duration_seconds = duration;
  emit({ type: "artifact", kind: "reel", data: artifact, at: now() });
  emit({ type: "agent.output", node: "reels", summary: `${duration}-second ${artifact.platform} production script ready`, at: now() });
  emit({ type: "agent.report", from: "reels", to: "content", summary: "Reel script and production plan delivered", at: now() });
  return {
    agent: "reels",
    title: artifact.title,
    summary: `${duration}-second ${artifact.platform} script ready`,
    output: artifact.beats.map((beat) => beat.spoken).filter(Boolean).join("\n\n"),
    source_titles: artifact.grounding,
  };
}

async function runLongform(
  instruction: string,
  notes: OwnerNote[],
  research: Contribution | undefined,
  emit: Emit,
  signal: AbortSignal
): Promise<Contribution> {
  emit({ type: "agent.activate", node: "longform", label: "Long-form video producer is online", at: now() });
  emit({ type: "agent.status", node: "longform", status: "Mapping packaging, payoffs, and retention loops", at: now() });
  const guide = await getContentGuide({ format: "longform", task: `${instruction}\n${research?.output || ""}` });
  if (guide) emit({ type: "agent.tool", node: "longform", tool: "Content guide", detail: guide.title, at: now() });
  emit({ type: "agent.tool", node: "longform", tool: "Voice DNA", detail: "Uploaded brand and knowledge notes", at: now() });
  const minutes = requestedLongformMinutes(instruction);
  const targetWords = Math.round(minutes * 150 * 0.85);
  const artifact = await openAIJson<LongformArtifactData>({
    name: "longform_video_production_script",
    schema: LONGFORM_SCHEMA,
    signal,
    maxOutputTokens: 30000,
    instructions:
      "You are the founder's senior long-form video strategist, YouTube scriptwriter, and retention editor. Return a complete, recordable production script, not an outline or a summary. " +
      `Build for ${minutes} minutes and roughly ${targetWords} spoken words, within ten percent. Set target_minutes to ${minutes}. ` +
      "Choose packaging first, map honest payoffs, then write timecoded chapters containing the exact spoken script. The intro must be fully scripted and should not be duplicated in chapter copy. " +
      "Visuals must be practical and specific. Every transition needs a retention device. The final lines must land the payoff and bridge into one specific next video without outro language. " +
      "Use only factual claims supported by supplied context. grounding may contain only exact titles of supplied notes.\n\n" +
      (guide ? `AUTHORITATIVE LONG-FORM PLAYBOOK, follow every applicable rule:\n${guide.body}` : ""),
    input: `Founder instruction:\n${instruction}\n\nRESEARCH HANDOFF:\n${research?.output || "No separate research run."}\n\nSECOND BRAIN, VOICE, AND BRAND CONTEXT:\n${knowledgeText(notes)}`,
  });
  artifact.target_minutes = minutes;
  artifact.chapters = artifact.chapters.map((chapter, index) => ({ ...chapter, n: index + 1 }));
  emit({ type: "artifact", kind: "longform", data: artifact, at: now() });
  emit({ type: "agent.output", node: "longform", summary: `${minutes}-minute ${artifact.format} production script ready`, at: now() });
  emit({ type: "agent.report", from: "longform", to: "content", summary: "Long-form script and production plan delivered", at: now() });
  return {
    agent: "longform",
    title: artifact.title,
    summary: `${minutes}-minute ${artifact.format} script ready`,
    output: [artifact.intro, ...artifact.chapters.map((chapter) => chapter.script), artifact.final_payoff, artifact.watch_next_bridge].join("\n\n"),
    source_titles: artifact.grounding,
  };
}

const POST_ANGLE_GUIDE: Record<TextPostArtifactData["angle"], string> = {
  standard: "A high-performing post with a strong hook, short punchy lines, and one clear takeaway.",
  story: "A vulnerable narrative: hook, tension, a turning point, and the lesson.",
  framework: "A save-worthy, numbered framework or list post with a clean structure.",
  contrarian: "A bold contrarian take that challenges conventional wisdom, punchy and specific.",
};

async function runTextPost(
  instruction: string,
  notes: OwnerNote[],
  research: Contribution | undefined,
  emit: Emit,
  signal: AbortSignal
): Promise<Contribution> {
  emit({ type: "agent.activate", node: "text", label: "Text post writer is online", at: now() });
  emit({ type: "agent.status", node: "text", status: "Auditioning hooks in the founder's voice", at: now() });
  const guide = await getContentGuide({ format: "text", task: `${instruction}\n${research?.output || ""}` });
  if (guide) emit({ type: "agent.tool", node: "text", tool: "Content guide", detail: guide.title, at: now() });
  emit({ type: "agent.tool", node: "text", tool: "Voice DNA", detail: "Uploaded brand and knowledge notes", at: now() });
  const artifact = await openAIJson<TextPostArtifactData>({
    name: "text_post",
    schema: TEXTPOST_SCHEMA,
    signal,
    maxOutputTokens: 9000,
    instructions:
      "You are the founder's elite ghostwriter. Write ONLY in their documented voice, grounded strictly in the second brain and brand kit. " +
      "Silently audition five opening lines, then commit to the strongest. Pick the single best angle for the request: " +
      Object.entries(POST_ANGLE_GUIDE).map(([key, guideText]) => `${key} (${guideText})`).join("; ") + ". " +
      "hook must be a scroll-stopping opening line, ideally under twelve words, and must be the exact first line of body. " +
      "body is the complete, ready-to-paste post with real line breaks. Short, punchy lines with white space. Do not put hashtags inside body. " +
      "No emojis unless the founder's voice clearly uses them. No hashtags unless requested. Never invent facts, metrics, quotes, or client stories. " +
      "cta is the closing engagement prompt. alt_hooks gives two or three alternative opening lines. hashtags omit the leading #. grounding may contain only exact supplied note titles.\n\n" +
      (guide ? `AUTHORITATIVE POST PLAYBOOK, follow every applicable rule:\n${guide.body}` : ""),
    input: `Founder instruction:\n${instruction}\n\nRESEARCH HANDOFF:\n${research?.output || "No separate research run."}\n\nSECOND BRAIN, VOICE, AND BRAND CONTEXT:\n${knowledgeText(notes)}`,
  });
  emit({ type: "artifact", kind: "text", data: artifact, at: now() });
  emit({ type: "agent.output", node: "text", summary: `${artifact.platform} ${artifact.angle} post ready`, at: now() });
  emit({ type: "agent.report", from: "text", to: "content", summary: "Text post delivered", at: now() });
  return { agent: "text", title: artifact.hook, summary: `${artifact.platform} post ready`, output: artifact.body, source_titles: artifact.grounding };
}

async function runPicturePost(
  instruction: string,
  notes: OwnerNote[],
  research: Contribution | undefined,
  emit: Emit,
  signal: AbortSignal
): Promise<Contribution> {
  emit({ type: "agent.activate", node: "picture", label: "Single-image post producer is online", at: now() });
  emit({ type: "agent.status", node: "picture", status: "Art-directing the visual and writing the caption", at: now() });
  const guide = await getContentGuide({ format: "picture", task: `${instruction}\n${research?.output || ""}` });
  if (guide) emit({ type: "agent.tool", node: "picture", tool: "Content guide", detail: guide.title, at: now() });
  emit({ type: "agent.tool", node: "picture", tool: "Voice DNA", detail: "Uploaded brand and knowledge notes", at: now() });
  const styleList = Object.entries(STYLE_PRESETS).map(([key, spec]) => `${key} (${spec.hint})`).join("; ");
  const artifact = await openAIJson<PicturePostArtifactData>({
    name: "picture_post",
    schema: PICTUREPOST_SCHEMA,
    signal,
    maxOutputTokens: 9000,
    instructions:
      "You are the founder's senior social art director and caption writer. Design one finished single-image post. " +
      `Choose the best style preset for the message from: ${styleList}. Choose aspect square, portrait, or landscape to fit the platform. ` +
      "concept is one vivid sentence describing the visual. image_prompt is a complete, self-contained prompt for a photorealistic image model: describe subject, setting, lighting, mood, and composition. Do not ask it to leave space for overlays. " +
      "The founder's real portrait, logo, and brand references from the brand kit are supplied to the image model automatically, so when a person is central, write the subject as the real founder and rely on the identity lock. " +
      "on_image_text is a short two-to-six word phrase to render on the image, or an empty string for a clean photo. " +
      "caption is the posting caption in the founder's voice, ending with cta. Match the founder's Voice DNA. No emojis unless their voice clearly uses them. " +
      "Only include hashtags if the founder explicitly asks for them or their voice guide uses them; otherwise return an empty hashtags array. When present, hashtags omit the leading #. " +
      "Never invent facts, metrics, quotes, or client stories. grounding may contain only exact supplied note titles.\n\n" +
      (guide ? `AUTHORITATIVE PLAYBOOK, follow every applicable rule:\n${guide.body}` : ""),
    input: `Founder instruction:\n${instruction}\n\nRESEARCH HANDOFF:\n${research?.output || "No separate research run."}\n\nSECOND BRAIN, VOICE, AND BRAND CONTEXT:\n${knowledgeText(notes)}`,
  });
  emit({ type: "artifact", kind: "picture", data: artifact, at: now() });
  emit({ type: "agent.output", node: "picture", summary: `${artifact.platform} image post ready`, at: now() });
  emit({ type: "agent.report", from: "picture", to: "content", summary: "Single-image post delivered", at: now() });
  return { agent: "picture", title: artifact.concept, summary: `${artifact.platform} image post ready`, output: `${artifact.concept}\n\nCaption:\n${artifact.caption}`, source_titles: artifact.grounding };
}

async function runFormat(
  format: ContentFormat,
  instruction: string,
  notes: OwnerNote[],
  research: Contribution | undefined,
  emit: Emit,
  signal: AbortSignal
): Promise<Contribution> {
  if (format === "text") return runTextPost(instruction, notes, research, emit, signal);
  if (format === "picture") return runPicturePost(instruction, notes, research, emit, signal);
  if (format === "carousel") return runCarousel(instruction, notes, research, emit, signal);
  if (format === "reels") return runReel(instruction, notes, research, emit, signal);
  if (format === "longform") return runLongform(instruction, notes, research, emit, signal);
  emit({ type: "agent.activate", node: format, label: `${node(format).title} producer is online`, at: now() });
  emit({ type: "agent.status", node: format, status: "Matching the founder's voice and playbook", at: now() });
  const guide = await getContentGuide({ format, task: `${instruction}\n${research?.output || ""}` });
  if (guide) emit({ type: "agent.tool", node: format, tool: "Content guide", detail: guide.title, at: now() });
  emit({ type: "agent.tool", node: format, tool: "Voice DNA", detail: "Uploaded brand and knowledge notes", at: now() });
  const result = await openAIJson<Omit<Contribution, "agent">>({
    name: `${format}_deliverable`,
    schema: CONTRIBUTION_SCHEMA,
    signal,
    maxOutputTokens: 16000,
    instructions:
      `You are the ${node(format).title} producer inside the founder's content team. ${FORMAT_BRIEF[format]} ` +
      "This must be a ready-to-use deliverable, not an outline or advice about writing one. Match the supplied brand voice. " +
      "Ground factual claims in the context and never invent metrics. source_titles may contain only exact supplied note titles.\n\n" +
      (guide ? `AUTHORITATIVE FORMAT PLAYBOOK — follow it closely:\n${guide.body}` : ""),
    input: `Instruction:\n${instruction}\n\nRESEARCH HANDOFF:\n${research?.output || "No separate research run."}\n\nSECOND BRAIN AND BRAND CONTEXT:\n${knowledgeText(notes)}`,
  });
  emit({ type: "agent.output", node: format, summary: result.summary, at: now() });
  emit({ type: "agent.report", from: format, to: "content", summary: `${node(format).title} deliverable ready`, at: now() });
  return { agent: format, ...result };
}

async function synthesize(
  instruction: string,
  plan: TeamPlan,
  contributions: Contribution[],
  signal: AbortSignal
): Promise<RichResponse> {
  const material = contributions.map((item) =>
    `## ${node(item.agent).title}: ${item.title}\nSummary: ${item.summary}\nSources: ${item.source_titles.join(", ") || "none"}\n\n${item.output}`
  ).join("\n\n");
  return openAIJson<RichResponse>({
    name: "jarvis_rich_briefing",
    schema: RICH_RESPONSE_SCHEMA,
    signal,
    maxOutputTokens: 16000,
    instructions:
      "You are the CEO presenting the marketing team's finished work. Return a polished briefing using the JSON block stockpile. " +
      "Report only what the agents produced. Preserve a finished post/script/newsletter verbatim in a text or quote block. " +
      "Choose blocks for the information shape, not decoration. Never invent numbers. Use 3-8 blocks and always finish with actions when action is appropriate. " +
      "Block field rules: text uses text; callout/keypoints/actions/stats/quote/chips/idea/timeline/steps/decision/people/kpi/meter/bars/define/table use body. " +
      "Unused fields must be empty strings. callout.variant is insight, win, warning, or note. " +
      "Bulleted bodies use one item per line. stats uses 'Label | Value | optional context'. steps uses 'Step title | description'. " +
      "timeline uses 'When | Title | detail'. decision uses '**When:** ... **Then:** ... **Because:** ...'. " +
      "kpi uses 'Value | Label | delta | context'. bars uses 'Label | value | unit'. table uses a pipe-delimited header row then data rows. " +
      "citations may only be exact source titles present in the agent material.",
    input: `Founder instruction:\n${instruction}\n\nCEO route:\n${plan.rationale}\n\nTEAM OUTPUT:\n${material}`,
  });
}

export async function POST(request: Request) {
  const { instruction } = (await request.json().catch(() => ({}))) as { instruction?: string };
  const text = instruction?.trim();
  if (!text) return new Response("Instruction required", { status: 400 });
  const runId = `run_${now().toString(36)}`;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit: Emit = (event) => controller.enqueue(encoder.encode(encodeEvent(event)));
      try {
        emit({ type: "run.start", runId, instruction: text, at: now() });
        emit({ type: "agent.activate", node: "kronos", label: "CEO is reading the intent", at: now() });
        emit({ type: "agent.status", node: "kronos", status: "Choosing the smallest capable team", at: now() });
        const plan = await planWithCeo(text, request.signal);
        emit({ type: "route", rationale: plan.rationale, assignments: plan.assignments, shared: plan.shared, at: now() });
        await beat();

        const allNotes = await listOwnerNotes();
        const brand = await getBrandKit();
        const brandNote: OwnerNote = { path: "Brand/Brand Kit.md", title: "Brand Kit", folder: "Brand", body: brandKitContext(brand) };
        const selectedNotes = selectKnowledge([brandNote, ...allNotes.filter((note) => note.title.toLowerCase() !== "brand kit")], text, isRecallQuery(text) ? 16 : 10);
        if (!selectedNotes.some((note) => note.path === brandNote.path)) selectedNotes.unshift(brandNote);
        const contributions: Contribution[] = [];
        let research: Contribution | undefined;

        if (plan.shared.includes("research")) {
          research = await runResearch(text, selectedNotes, emit, request.signal);
          contributions.push(research);
        }

        for (const assignment of plan.assignments) {
          if (!assignment.plan.length) {
            contributions.push(await runCmo(text, selectedNotes, research, emit, request.signal));
            continue;
          }
          emit({ type: "agent.activate", node: "cmo", label: "CMO takes the assignment", at: now() });
          emit({ type: "agent.status", node: "cmo", status: `Delegating to ${assignment.plan.length} content producer${assignment.plan.length > 1 ? "s" : ""}`, at: now() });
          emit({ type: "agent.activate", node: "content", label: "Content is coordinating the deliverable", at: now() });
          const produced = await Promise.all(assignment.plan.map((format) =>
            runFormat(format as ContentFormat, text, selectedNotes, research, emit, request.signal)
          ));
          contributions.push(...produced);
          emit({ type: "agent.report", from: "content", to: "cmo", summary: "All requested formats delivered", at: now() });
          emit({ type: "agent.report", from: "cmo", to: "kronos", summary: "Content package delivered", at: now() });
        }

        const onlyFormat = plan.assignments.length === 1 && plan.assignments[0].plan.length === 1 ? plan.assignments[0].plan[0] : null;
        const dedicatedArtifactOnly = onlyFormat === "carousel" || onlyFormat === "reels" || onlyFormat === "longform" || onlyFormat === "text" || onlyFormat === "picture";
        let synthesized: RichResponse | undefined;
        if (!dedicatedArtifactOnly) {
          emit({ type: "agent.status", node: "kronos", status: "Assembling the final briefing", at: now() });
          synthesized = await synthesize(text, plan, contributions, request.signal);
          emit({ type: "response", format: "blocks-json", data: synthesized, at: now() });
        }

        // Journal this chat into the second brain so Jarvis remembers what it did.
        emit({ type: "agent.status", node: "kronos", status: "Filing this chat into your second brain", at: now() });
        const savedTitle = await recordSession({
          runId,
          at: now(),
          instruction: text,
          rationale: plan.rationale,
          producedFormats: plan.assignments.flatMap((assignment) => assignment.plan),
          contributions: contributions
            .filter((contribution) => contribution.agent !== "research")
            .map((contribution) => ({ agent: node(contribution.agent).title, title: contribution.title, summary: contribution.summary, output: contribution.output })),
          citations: [...new Set([...(synthesized?.citations ?? []), ...contributions.flatMap((contribution) => contribution.source_titles)])],
        });
        if (savedTitle) emit({ type: "agent.tool", node: "kronos", tool: "Memory", detail: savedTitle, at: now() });

        emit({ type: "agent.status", node: "kronos", status: "Done. The team's output is ready.", at: now() });
        emit({ type: "run.complete", at: now() });
      } catch (error) {
        emit({ type: "run.error", message: error instanceof Error ? error.message : String(error), at: now() });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
