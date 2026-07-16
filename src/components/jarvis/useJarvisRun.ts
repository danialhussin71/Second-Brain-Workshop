"use client";

import { useCallback, useRef, useState } from "react";
import { drainEvents, type CarouselArtifactData, type JarvisEvent, type JarvisNodeId, type LongformArtifactData, type NewsletterArtifactData, type PicturePostArtifactData, type ReelArtifactData, type TextPostArtifactData } from "@/lib/jarvis-events";
import { node } from "@/lib/org";
import type { RichResponse } from "@/lib/rich-response";

export type NodePhase = "idle" | "waking" | "working" | "reporting" | "done";
export type FeedEntry = { id: number; node: JarvisNodeId; kind: "route" | "activate" | "status" | "tool" | "output" | "report"; text: string; at: number };
export type JarvisRunState = {
  running: boolean;
  done: boolean;
  instruction: string;
  rationale?: string;
  departments: JarvisNodeId[];
  plan: JarvisNodeId[];
  active?: JarvisNodeId;
  litPath: JarvisNodeId[];
  phases: Partial<Record<JarvisNodeId, NodePhase>>;
  feed: FeedEntry[];
  response?: RichResponse;
  carouselArtifact?: CarouselArtifactData;
  reelArtifact?: ReelArtifactData;
  longformArtifact?: LongformArtifactData;
  newsletterArtifact?: NewsletterArtifactData;
  textPostArtifact?: TextPostArtifactData;
  picturePostArtifact?: PicturePostArtifactData;
  error?: string;
};

const EMPTY: JarvisRunState = { running: false, done: false, instruction: "", departments: [], plan: [], litPath: [], phases: {}, feed: [] };

function ancestors(id: JarvisNodeId): JarvisNodeId[] {
  const path: JarvisNodeId[] = [id];
  let parent = node(id).parent;
  while (parent) { path.push(parent); parent = node(parent).parent; }
  return path;
}

function toolLabel(tool: string): string {
  if (/brain|vault/i.test(tool)) return "Reading your second brain";
  if (/voice/i.test(tool)) return "Matching your voice";
  return tool;
}

function reduce(state: JarvisRunState, event: JarvisEvent, id: () => number): JarvisRunState {
  const add = (next: Partial<JarvisRunState>, feed?: Omit<FeedEntry, "id">): JarvisRunState => ({
    ...state,
    ...next,
    feed: feed ? [...state.feed, { id: id(), ...feed }].slice(-80) : state.feed,
  });
  switch (event.type) {
    case "run.start": return state;
    case "route": {
      const departments = event.assignments.map((assignment) => assignment.department);
      return add(
        { rationale: event.rationale, departments, plan: [...event.shared, ...event.assignments.flatMap((assignment) => assignment.plan)], active: "kronos", litPath: ["kronos"] },
        { node: "kronos", kind: "route", text: event.rationale, at: event.at }
      );
    }
    case "agent.activate": return add(
      { active: event.node, litPath: ancestors(event.node), phases: { ...state.phases, [event.node]: "working" } },
      { node: event.node, kind: "activate", text: event.label, at: event.at }
    );
    case "agent.status": return add(
      { active: event.node, litPath: ancestors(event.node) },
      { node: event.node, kind: "status", text: event.status, at: event.at }
    );
    case "agent.tool": return add({}, { node: event.node, kind: "tool", text: `${toolLabel(event.tool)}${event.detail ? ` · ${event.detail}` : ""}`, at: event.at });
    case "agent.output": return add(
      { phases: { ...state.phases, [event.node]: "done" } },
      { node: event.node, kind: "output", text: event.summary, at: event.at }
    );
    case "agent.report": return add(
      { active: event.to, litPath: ancestors(event.from), phases: { ...state.phases, [event.from]: "done" } },
      { node: event.from, kind: "report", text: `${node(event.from).title} → ${node(event.to).title}: ${event.summary}`, at: event.at }
    );
    case "artifact": {
      if (event.kind === "carousel") return add({ carouselArtifact: event.data });
      if (event.kind === "reel") return add({ reelArtifact: event.data });
      if (event.kind === "longform") return add({ longformArtifact: event.data });
      if (event.kind === "newsletter") return add({ newsletterArtifact: event.data });
      if (event.kind === "text") return add({ textPostArtifact: event.data });
      if (event.kind === "picture") return add({ picturePostArtifact: event.data });
      return state;
    }
    case "response": return add({ response: event.data });
    case "run.complete": return add({ running: false, done: true, active: "kronos", litPath: ["kronos"], phases: { ...state.phases, kronos: "done" } });
    case "run.error": return add({ running: false, error: event.message });
    default: return state;
  }
}

export function useJarvisRun() {
  const [state, setState] = useState<JarvisRunState>(EMPTY);
  const feedId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (instruction: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    feedId.current = 0;
    const nextId = () => feedId.current++;
    setState({ ...EMPTY, running: true, instruction });
    try {
      const response = await fetch("/api/jarvis/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instruction }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error(await response.text() || "Jarvis could not start.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const drained = drainEvents(buffer);
        buffer = drained.rest;
        for (const event of drained.events) setState((current) => reduce(current, event, nextId));
      }
    } catch (error) {
      if (!controller.signal.aborted) setState((current) => ({ ...current, running: false, error: error instanceof Error ? error.message : String(error) }));
    }
  }, []);
  return { state, run };
}
