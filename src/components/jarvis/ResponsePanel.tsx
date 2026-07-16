"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle } from "@phosphor-icons/react";
import { Blocks } from "@/components/blocks/Blocks";
import { toUiBlock } from "@/lib/rich-response";
import { node } from "@/lib/org";
import type { JarvisRunState } from "./useJarvisRun";
import BrainOrb from "./BrainOrb";
import CarouselArtifact from "./CarouselArtifact";
import ReelScriptArtifact from "./ReelScriptArtifact";
import LongformScriptArtifact from "./LongformScriptArtifact";
import NewsletterArtifact from "./NewsletterArtifact";
import TextPostArtifact from "./TextPostArtifact";
import PicturePostArtifact from "./PicturePostArtifact";

export default function ResponsePanel({ state }: { state: JarvisRunState }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const latest = state.feed.at(-1);
  const activeNode = state.active ? node(state.active) : null;
  const blocks = useMemo(() => state.response?.blocks.map(toUiBlock) || [], [state.response]);
  const idle = !state.running && state.feed.length === 0;
  const deliverables = [
    ...(state.textPostArtifact ? [{ key: "text" as const, label: "Text post" }] : []),
    ...(state.picturePostArtifact ? [{ key: "picture" as const, label: "Image post" }] : []),
    ...(state.carouselArtifact ? [{ key: "carousel" as const, label: "Carousel" }] : []),
    ...(state.reelArtifact ? [{ key: "reel" as const, label: "Reel script" }] : []),
    ...(state.longformArtifact ? [{ key: "longform" as const, label: "Video script" }] : []),
    ...(state.newsletterArtifact ? [{ key: "newsletter" as const, label: "Newsletter" }] : []),
    ...(blocks.length ? [{ key: "briefing" as const, label: "Briefing" }] : []),
  ];
  const [selected, setSelected] = useState<"text" | "picture" | "carousel" | "reel" | "longform" | "newsletter" | "briefing" | null>(null);
  const active = selected && deliverables.some((item) => item.key === selected) ? selected : deliverables[0]?.key;

  return <div className="flex h-full flex-col overflow-hidden rounded-[20px] border border-white/12 bg-gradient-to-b from-white/[0.07] via-white/[0.025] to-transparent shadow-[0_30px_80px_-42px_rgba(0,0,0,0.92)] ring-1 ring-inset ring-white/[0.06] backdrop-blur-2xl backdrop-saturate-150">
    {deliverables.length > 1 && <div className="flex shrink-0 gap-1 border-b border-white/[.07] px-3 py-2">{deliverables.map((item) => <button key={item.key} onClick={() => setSelected(item.key)} className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${active === item.key ? "bg-white/10 text-white" : "text-white/45 hover:text-white/80"}`}>{item.label}</button>)}</div>}
    <div className="relative min-h-0 flex-1">
      <AnimatePresence mode="wait">
        {active === "text" && state.textPostArtifact ? <motion.div key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0"><TextPostArtifact data={state.textPostArtifact} /></motion.div> : active === "picture" && state.picturePostArtifact ? <motion.div key="picture" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0"><PicturePostArtifact data={state.picturePostArtifact} /></motion.div> : active === "carousel" && state.carouselArtifact ? <motion.div key="carousel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0"><CarouselArtifact data={state.carouselArtifact} /></motion.div> : active === "reel" && state.reelArtifact ? <motion.div key="reel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0"><ReelScriptArtifact data={state.reelArtifact} /></motion.div> : active === "longform" && state.longformArtifact ? <motion.div key="longform" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0"><LongformScriptArtifact data={state.longformArtifact} /></motion.div> : active === "newsletter" && state.newsletterArtifact ? <motion.div key="newsletter" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0"><NewsletterArtifact data={state.newsletterArtifact} /></motion.div> : active === "briefing" && blocks.length ? <motion.div key="response" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0"><div ref={scrollRef} className="h-full overflow-y-auto bg-gradient-to-b from-white/[0.08] via-white/[0.03] to-transparent px-4 py-4 text-[13.5px] leading-relaxed"><div className="mb-3"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-300">Jarvis briefing</p><h2 className="mt-1 text-lg font-semibold text-white">{state.response?.title}</h2>{state.response?.summary && <p className="mt-1 text-xs leading-relaxed text-white/45">{state.response.summary}</p>}</div><Blocks blocks={blocks} stream scrollRef={scrollRef} />{state.response?.citations.length ? <div className="mt-5 border-t border-white/10 pt-3"><p className="text-[9px] font-semibold uppercase tracking-[.18em] text-white/35">Grounded in</p><div className="mt-2 flex flex-wrap gap-1.5">{state.response.citations.map((citation) => <span key={citation} className="rounded-md border border-cyan-300/15 bg-cyan-400/[.06] px-2 py-1 text-[10px] text-cyan-100/65">{citation}</span>)}</div></div> : null}</div></motion.div> : <motion.div key="brain" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0"><BrainOrb /><div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#02040a] via-[#02040a]/75 to-transparent" /><div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-6 pb-8 text-center"><motion.div key={`${state.active || "idle"}-${latest?.id || 0}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="max-w-[310px]">{idle ? <><h2 className="text-[18px] font-bold">CEO</h2><p className="mt-1 text-[12px] leading-relaxed text-white/45">Your AI CEO reads every document and routes every marketing job. Give it one instruction.</p></> : <><div className="flex items-center justify-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: activeNode?.color || "#22d3ee", boxShadow: `0 0 10px ${activeNode?.color || "#22d3ee"}` }} /><span className="text-[11px] font-semibold uppercase tracking-[.16em]" style={{ color: activeNode?.color || "#22d3ee" }}>{activeNode?.title || "CEO"}</span></div><p className="mt-1.5 text-[13px] leading-relaxed text-white/70">{latest?.text || "Working…"}</p></>}</motion.div></div></motion.div>}
      </AnimatePresence>
    </div>
    {(state.done || state.error) && <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="shrink-0 border-t border-white/[.07] px-4 py-2.5">{state.error ? <p className="text-[12px] text-rose-300">{state.error}</p> : <p className="flex items-center gap-2 text-[12px] text-emerald-300"><CheckCircle size={15} weight="fill" />Run complete · deliverable ready</p>}</motion.div>}
  </div>;
}
