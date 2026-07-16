/**
 * Pulse / KRONOS — the live event protocol.
 *
 * One run of the mission-control orchestrator (`/api/jarvis/run`) emits a stream
 * of these events as NDJSON (one JSON object per line). The dashboard consumes
 * them to drive the orb, the org chart, the live agent feed, and the final
 * artifact. Shared by server (emit) and client (render) so they never drift.
 *
 * The hierarchy: You -> KRONOS (AI CEO, reads every document) -> the CMO ->
 * specialist sub-agents. This build is marketing-only, so the CMO is the only
 * department head.
 */

import type { RichResponse } from "./rich-response";
import { stripEmDashesDeep } from "./sanitize";

export type JarvisNodeId =
  | "kronos"
  // department head (marketing-only build)
  | "cmo"
  // specialists
  | "research"
  | "content"
  // content formats (under Content)
  | "text"
  | "picture"
  | "carousel"
  | "reels"
  | "longform"
  | "newsletter";

/** A specialist's lifecycle phase, used to colour its node + feed row. */
export type AgentPhase = "idle" | "waking" | "working" | "reporting" | "done";

/** One department head + the ordered specialists it will fire. */
export type RouteAssignment = { department: JarvisNodeId; plan: JarvisNodeId[] };

export type CarouselSlide = {
  n: number;
  kind: "hook" | "body" | "cta";
  title: string;
  body: string;
  /** a generated slide image (data URL), when the image model is configured */
  image?: string;
  /** per-slide prompt metadata — the CLIENT uses these to render each image */
  layout?: "split" | "stacked" | "statement";
  visual?: string;
  logos?: string[];
};

export type CarouselArtifactData = {
  topic: string;
  hook: string;
  slides: CarouselSlide[];
  caption: string;
  /** doc titles the work was grounded in (for the "what it read" trail) */
  grounding: string[];
  /** the shared visual style paragraph — passed to the per-slide image endpoint */
  styleBible?: string;
};

/** The retention structure every short-form script follows, beat by beat. */
export type ReelBeatRole = "hook" | "rehook" | "body" | "payoff" | "cta";

export type ReelBeat = {
  role: ReelBeatRole;
  timecode: string;
  duration_seconds: number;
  /** The spoken words, ONE SENTENCE PER LINE — each line is one spoken beat. */
  spoken: string;
  visual: string;
  onscreen_text: string;
  edit: string;
};

export type ReelArtifactData = {
  title: string;
  platform: "Instagram Reels" | "TikTok" | "YouTube Shorts" | "LinkedIn video";
  objective: string;
  duration_seconds: number;
  word_count: number;
  hook: {
    spoken: string;
    visual: string;
    onscreen_text: string;
  };
  beats: ReelBeat[];
  cta: string;
  caption: string;
  production: {
    delivery: string;
    music: string;
    captions: string;
    shot_list: string[];
  };
  grounding: string[];
};

export type LongformChapter = {
  n: number;
  timecode: string;
  title: string;
  objective: string;
  script: string;
  visuals: string[];
  retention_device: string;
};

export type LongformArtifactData = {
  title: string;
  format: "YouTube video" | "Video essay" | "Tutorial" | "Case study" | "Documentary" | "Talking head" | "VSL";
  target_minutes: number;
  estimated_words: number;
  click_promise: string;
  thumbnail: {
    concept: string;
    text: string;
  };
  intro: string;
  payoff_map: string[];
  chapters: LongformChapter[];
  subscribe_line: string;
  final_payoff: string;
  watch_next_bridge: string;
  production_notes: string[];
  grounding: string[];
};

export type NewsletterArtifactData = {
  subject: string;
  preview: string;
  /** the complete, self-contained newsletter HTML — light-themed, in the founder's
   *  brand DNA, with any generated image assets inlined as data URLs */
  html: string;
  grounding: string[];
};

/** A finished, ready-to-publish text post written in the founder's voice. */
export type TextPostArtifactData = {
  platform: "LinkedIn" | "X" | "Instagram" | "Threads" | "Facebook";
  /** the ghostwriting frame used — mirrors FounderOS post formats */
  angle: "standard" | "story" | "framework" | "contrarian";
  /** the scroll-stopping opening line (also the first line of `body`) */
  hook: string;
  /** the complete post text, ready to paste, hook included, line breaks preserved */
  body: string;
  /** the closing call to action / engagement prompt (may be folded into body) */
  cta: string;
  /** optional hashtags, without the leading # */
  hashtags: string[];
  /** two or three alternative opening hooks the founder can swap in */
  alt_hooks: string[];
  grounding: string[];
};

/** A finished single-image ("picture") post: art-directed image brief + caption. */
export type PicturePostArtifactData = {
  platform: "Instagram" | "LinkedIn" | "Facebook" | "X";
  aspect: "square" | "portrait" | "landscape";
  /** style preset label, e.g. "Editorial", "Hyper-realistic", "Brand graphic" */
  style: string;
  /** one-line description of the visual concept */
  concept: string;
  /** the complete, self-contained prompt handed to the image model */
  image_prompt: string;
  /** optional short text to render inside the image ("" if none) */
  on_image_text: string;
  /** the posting caption in the founder's voice */
  caption: string;
  /** the closing call to action */
  cta: string;
  hashtags: string[];
  grounding: string[];
};

export type JarvisEvent =
  | { type: "run.start"; runId: string; instruction: string; at: number }
  /** KRONOS has read the intent and delegated to one or more department heads. */
  | {
      type: "route";
      rationale: string;
      /** every department head assigned, each with its ordered specialist plan */
      assignments: RouteAssignment[];
      /** shared specialists (e.g. research) that run ONCE for the whole team */
      shared: JarvisNodeId[];
      at: number;
    }
  /** A node comes online (department head or specialist). */
  | { type: "agent.activate"; node: JarvisNodeId; label: string; at: number }
  /** A short status line for the feed ("reading your ICP", "writing slides"). */
  | { type: "agent.status"; node: JarvisNodeId; status: string; at: number }
  /** A concrete tool action — a document read, a search, a web fetch. */
  | {
      type: "agent.tool";
      node: JarvisNodeId;
      tool: string;
      detail: string;
      at: number;
    }
  /** A specialist finished its piece of work. */
  | { type: "agent.output"; node: JarvisNodeId; summary: string; at: number }
  /** Work reports back UP the chain (specialist -> head -> CEO). */
  | {
      type: "agent.report";
      from: JarvisNodeId;
      to: JarvisNodeId;
      summary: string;
      at: number;
    }
  /** The finished deliverable. */
  | { type: "artifact"; kind: "carousel"; data: CarouselArtifactData; at: number }
  | { type: "artifact"; kind: "reel"; data: ReelArtifactData; at: number }
  | { type: "artifact"; kind: "longform"; data: LongformArtifactData; at: number }
  | { type: "artifact"; kind: "newsletter"; data: NewsletterArtifactData; at: number }
  | { type: "artifact"; kind: "text"; data: TextPostArtifactData; at: number }
  | { type: "artifact"; kind: "picture"; data: PicturePostArtifactData; at: number }
  /** Strict JSON from the CEO, rendered by the shared response-block stockpile. */
  | { type: "response"; format: "blocks-json"; data: RichResponse; at: number }
  | { type: "run.complete"; at: number }
  | { type: "run.error"; message: string; at: number };

export type JarvisEventType = JarvisEvent["type"];

/** Encode one event as a single NDJSON line. */
export function encodeEvent(e: JarvisEvent): string {
  return JSON.stringify(stripEmDashesDeep(e)) + "\n";
}

/** Parse a buffered NDJSON chunk into events + the leftover partial line. */
export function drainEvents(buffer: string): { events: JarvisEvent[]; rest: string } {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  const events: JarvisEvent[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed) as JarvisEvent);
    } catch {
      // ignore a malformed line rather than killing the stream
    }
  }
  return { events, rest };
}
