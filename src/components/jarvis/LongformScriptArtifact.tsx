"use client";

import { useState } from "react";
import { Check, Copy, DownloadSimple, FilmSlate, Gift, PlayCircle, PresentationChart } from "@phosphor-icons/react";
import type { LongformArtifactData } from "@/lib/jarvis-events";
import { DeliverableEyebrow } from "./DeliverableEyebrow";

type Tab = "script" | "production" | "packaging";

/** One sentence per line — the writer emits them newline-separated. */
const lines = (text: string) => (text || "").split("\n").map((line) => line.trim()).filter(Boolean);

/** The teleprompter export: just the words, in running order. */
function spokenScript(data: LongformArtifactData) {
  return [
    lines(data.intro).join("\n"),
    ...data.chapters.map((chapter) => lines(chapter.script).join("\n")),
    lines(data.final_payoff).join("\n"),
    lines(data.watch_next_bridge).join("\n"),
  ].filter(Boolean).join("\n\n");
}

function exportScript(data: LongformArtifactData) {
  return [
    data.title,
    `${data.format} | ${data.target_minutes} minutes | ${data.estimated_words} words`,
    `\nCLICK PROMISE\n${data.click_promise}`,
    `\nINTRO\n${data.intro}`,
    ...data.chapters.map((chapter) => `\n${chapter.timecode} | CHAPTER ${chapter.n}: ${chapter.title}\n${chapter.script}\n\nVISUALS\n${chapter.visuals.map((item) => `- ${item}`).join("\n")}\n\nRETENTION DEVICE\n${chapter.retention_device}`),
    `\nSUBSCRIBE LINE\n${data.subscribe_line}`,
    `\nFINAL PAYOFF\n${data.final_payoff}`,
    `\nWATCH NEXT BRIDGE\n${data.watch_next_bridge}`,
  ].join("\n");
}

export default function LongformScriptArtifact({ data }: { data: LongformArtifactData }) {
  const [tab, setTab] = useState<Tab>("script");
  const [copied, setCopied] = useState(false);
  // On the script tab, copy exactly what is on screen: the spoken words only.
  const copy = async () => {
    await navigator.clipboard.writeText(tab === "script" ? spokenScript(data) : exportScript(data));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const download = () => {
    const blob = new Blob([exportScript(data)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "video-script"}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return <div className="h-full overflow-y-auto bg-[#060811] text-white">
    <div className="sticky top-0 z-20 border-b border-white/[.07] bg-[#080a13]/90 px-4 py-3 backdrop-blur-xl">
      <div className="flex items-center justify-between"><DeliverableEyebrow /><div className="flex gap-1.5"><button onClick={copy} aria-label="Copy script" className="rounded-lg border border-white/10 bg-white/[.05] p-2 text-white/55 hover:bg-white/10 hover:text-white">{copied ? <Check size={15} className="text-emerald-300" /> : <Copy size={15} />}</button><button onClick={download} aria-label="Download text file" title="Download plain text" className="rounded-lg border border-white/10 bg-white/[.05] p-2 text-white/55 hover:bg-white/10 hover:text-white"><DownloadSimple size={15} /></button></div></div>
      <div className="mt-3 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[.18em] text-cyan-300"><FilmSlate size={15} weight="duotone" />Long-form production script</div>
      <h2 className="mt-1.5 text-xl font-semibold leading-tight tracking-[-.02em]">{data.title}</h2>
      <div className="mt-3 grid grid-cols-3 gap-1.5">{[data.format, `${data.target_minutes} min`, `${data.estimated_words} words`].map((value) => <div key={value} className="rounded-lg border border-white/[.07] bg-white/[.035] px-2 py-1.5 text-center text-[10px] text-white/60">{value}</div>)}</div>
      <div className="mt-3 flex rounded-lg bg-black/25 p-1">{(["script", "production", "packaging"] as Tab[]).map((item) => <button key={item} onClick={() => setTab(item)} className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-semibold capitalize transition ${tab === item ? "bg-white/10 text-white" : "text-white/35 hover:text-white/65"}`}>{item}</button>)}</div>
    </div>

    {tab === "script" ? (
      /* The teleprompter: only the words, one sentence per line. */
      <div className="px-4 py-5">
        <section className="relative pl-5">
          <span className="absolute left-0 top-[7px] h-1.5 w-1.5 rounded-full bg-cyan-300" />
          <span className="absolute bottom-1 left-[2.5px] top-[18px] w-px bg-gradient-to-b from-white/10 to-white/[.04]" />
          <div className="text-[9px] font-bold uppercase tracking-[.2em] text-cyan-300">Intro</div>
          <div className="mt-2.5 space-y-2">{lines(data.intro).map((line, index) => <p key={index} className="text-[16px] font-medium leading-[1.5] tracking-[-.011em] text-white/90">{line}</p>)}</div>
        </section>

        {data.chapters.map((chapter) => <section key={chapter.n} className="relative mt-6 pl-5">
          <span className="absolute left-0 top-[7px] h-1.5 w-1.5 rounded-full bg-white/30" />
          <span className="absolute bottom-1 left-[2.5px] top-[18px] w-px bg-gradient-to-b from-white/10 to-white/[.04]" />
          <div className="flex items-baseline gap-2">
            <span className="text-[9px] font-bold uppercase tracking-[.2em] text-white/45">{String(chapter.n).padStart(2, "0")} · {chapter.title}</span>
            <span className="font-mono text-[9px] text-white/25">{chapter.timecode}</span>
          </div>
          <div className="mt-2.5 space-y-2">{lines(chapter.script).map((line, index) => <p key={index} className="text-[15.5px] leading-[1.55] tracking-[-.01em] text-white/85">{line}</p>)}</div>
        </section>)}

        <section className="relative mt-6 pl-5">
          <span className="absolute left-0 top-[7px] h-1.5 w-1.5 rounded-full bg-amber-300" />
          <span className="absolute bottom-1 left-[2.5px] top-[18px] w-px bg-gradient-to-b from-white/10 to-transparent" />
          <div className="text-[9px] font-bold uppercase tracking-[.2em] text-amber-300">Payoff</div>
          <div className="mt-2.5 space-y-2">{lines(data.final_payoff).map((line, index) => <p key={index} className="text-[16px] font-medium leading-[1.5] tracking-[-.011em] text-white/90">{line}</p>)}</div>
        </section>

        <section className="relative mt-6 pl-5">
          <span className="absolute left-0 top-[7px] h-1.5 w-1.5 rounded-full bg-emerald-300" />
          <div className="text-[9px] font-bold uppercase tracking-[.2em] text-emerald-300">Watch next</div>
          <div className="mt-2.5 space-y-2">{lines(data.watch_next_bridge).map((line, index) => <p key={index} className="text-[16px] font-medium leading-[1.5] tracking-[-.011em] text-white/90">{line}</p>)}</div>
        </section>
      </div>
    ) : tab === "production" ? <div className="space-y-3 p-4">
      <Panel icon={<Gift size={15} weight="duotone" />} label="Payoff map" accent="text-amber-300"><ol className="space-y-2">{data.payoff_map.map((item, index) => <li key={index} className="flex gap-2 text-[12px] leading-relaxed text-white/60"><span className="font-mono text-[9px] text-amber-300/45">{String(index + 1).padStart(2, "0")}</span>{item}</li>)}</ol></Panel>
      <Panel icon={<PlayCircle size={15} />} label="Mid-video subscribe line" accent="text-fuchsia-300"><p className="text-[12px] leading-relaxed text-white/65">{data.subscribe_line}</p></Panel>
      <Panel icon={<PresentationChart size={15} />} label="Production notes" accent="text-cyan-300"><ul className="space-y-2">{data.production_notes.map((item, index) => <li key={index} className="flex gap-2 text-[12px] leading-relaxed text-white/60"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan-300/60" />{item}</li>)}</ul></Panel>
      {/* Per-chapter shots and retention devices live here, off the script page. */}
      <div className="space-y-2">{data.chapters.map((chapter) => <div key={chapter.n} className="rounded-xl border border-white/[.07] bg-white/[.03] p-3"><div className="flex items-center justify-between"><span className="text-[10px] font-medium text-white/65">{String(chapter.n).padStart(2, "0")} · {chapter.title}</span><span className="font-mono text-[9px] text-white/25">{chapter.timecode}</span></div><ul className="mt-2 space-y-1.5">{chapter.visuals.map((visual, index) => <li key={index} className="flex gap-2 text-[10px] leading-relaxed text-white/40"><span className="shrink-0 text-cyan-300/50">SHOT</span>{visual}</li>)}</ul>{chapter.retention_device ? <p className="mt-2 flex gap-2 border-t border-white/[.06] pt-2 text-[10px] leading-relaxed text-white/40"><span className="shrink-0 font-bold tracking-[.12em] text-amber-300/70">RETENTION</span>{chapter.retention_device}</p> : null}</div>)}</div>
    </div> : <div className="space-y-3 p-4">
      <Panel icon={<PlayCircle size={15} />} label="Click promise" accent="text-cyan-300"><p className="text-[13px] leading-relaxed text-white/70">{data.click_promise}</p></Panel>
      <div className="relative overflow-hidden rounded-2xl border border-fuchsia-300/15 bg-gradient-to-br from-fuchsia-400/[.1] to-transparent p-4"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-fuchsia-300">Thumbnail direction</p><div className="mt-4 flex aspect-video items-center justify-center rounded-xl border border-white/10 bg-black/35 p-5 text-center"><div><p className="text-lg font-black uppercase tracking-tight">{data.thumbnail.text}</p><p className="mx-auto mt-2 max-w-[260px] text-[10px] leading-relaxed text-white/35">{data.thumbnail.concept}</p></div></div></div>
      {data.grounding.length ? <Panel icon={<PresentationChart size={15} />} label="Grounded in" accent="text-emerald-300"><div className="flex flex-wrap gap-1.5">{data.grounding.map((item) => <span key={item} className="rounded-md bg-emerald-400/[.07] px-2 py-1 text-[9px] text-emerald-100/55">{item}</span>)}</div></Panel> : null}
    </div>}
  </div>;
}

function Panel({ icon, label, accent, children }: { icon: React.ReactNode; label: string; accent: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-white/[.075] bg-white/[.035] p-3.5"><div className={`flex items-center gap-2 ${accent}`}>{icon}<p className="text-[9px] font-bold uppercase tracking-[.18em]">{label}</p></div><div className="mt-3">{children}</div></section>;
}
