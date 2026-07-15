"use client";

import { useState } from "react";
import { Check, Copy, DownloadSimple, FilePdf, FilmSlate, Gift, PlayCircle, PresentationChart } from "@phosphor-icons/react";
import type { LongformArtifactData } from "@/lib/jarvis-events";
import { DeliverableEyebrow } from "./DeliverableEyebrow";

type Tab = "script" | "production" | "packaging";

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
  const copy = async () => {
    await navigator.clipboard.writeText(exportScript(data));
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
  const downloadAsPdf = async () => {
    const { createLongformScriptPdf, downloadPdf } = await import("@/lib/script-pdf");
    downloadPdf(await createLongformScriptPdf(data), data.title);
  };

  return <div className="h-full overflow-y-auto bg-[#060811] text-white">
    <div className="sticky top-0 z-20 border-b border-white/[.07] bg-[#080a13]/90 px-4 py-3 backdrop-blur-xl">
      <div className="flex items-center justify-between"><DeliverableEyebrow /><div className="flex gap-1.5"><button onClick={copy} aria-label="Copy script" className="rounded-lg border border-white/10 bg-white/[.05] p-2 text-white/55 hover:bg-white/10 hover:text-white">{copied ? <Check size={15} className="text-emerald-300" /> : <Copy size={15} />}</button><button onClick={downloadAsPdf} aria-label="Download PDF" title="Download branded PDF" className="rounded-lg border border-white/10 bg-white/[.05] p-2 text-white/55 hover:bg-white/10 hover:text-white"><FilePdf size={15} /></button><button onClick={download} aria-label="Download text file" title="Download plain text" className="rounded-lg border border-white/10 bg-white/[.05] p-2 text-white/55 hover:bg-white/10 hover:text-white"><DownloadSimple size={15} /></button></div></div>
      <div className="mt-3 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[.18em] text-cyan-300"><FilmSlate size={15} weight="duotone" />Long-form production script</div>
      <h2 className="mt-1.5 text-xl font-semibold leading-tight tracking-[-.02em]">{data.title}</h2>
      <div className="mt-3 grid grid-cols-3 gap-1.5">{[data.format, `${data.target_minutes} min`, `${data.estimated_words} words`].map((value) => <div key={value} className="rounded-lg border border-white/[.07] bg-white/[.035] px-2 py-1.5 text-center text-[10px] text-white/60">{value}</div>)}</div>
      <div className="mt-3 flex rounded-lg bg-black/25 p-1">{(["script", "production", "packaging"] as Tab[]).map((item) => <button key={item} onClick={() => setTab(item)} className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-semibold capitalize transition ${tab === item ? "bg-white/10 text-white" : "text-white/35 hover:text-white/65"}`}>{item}</button>)}</div>
    </div>

    {tab === "script" ? <div className="p-4">
      <div className="overflow-hidden rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-cyan-400/[.12] via-blue-400/[.05] to-transparent p-4">
        <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.2em] text-cyan-300"><PlayCircle size={14} weight="fill" />0:00 · Click confirmation</div>
        <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-white/85">{data.intro}</p>
      </div>
      <div className="mt-4 flex items-center gap-2"><div className="h-px flex-1 bg-gradient-to-r from-cyan-400/35 to-transparent" /><span className="text-[9px] font-semibold uppercase tracking-[.2em] text-white/30">Chapter timeline</span></div>
      <div className="mt-3 space-y-3">{data.chapters.map((chapter) => <article key={chapter.n} className="overflow-hidden rounded-xl border border-white/[.075] bg-white/[.03]">
        <div className="flex items-start gap-3 border-b border-white/[.06] bg-white/[.02] p-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-300/15 bg-cyan-400/[.07] font-mono text-[10px] text-cyan-300">{String(chapter.n).padStart(2, "0")}</span><div className="min-w-0"><p className="font-mono text-[9px] text-cyan-300/70">{chapter.timecode}</p><h3 className="mt-0.5 text-[13px] font-semibold text-white/85">{chapter.title}</h3><p className="mt-0.5 text-[10px] text-white/35">{chapter.objective}</p></div></div>
        <div className="p-3"><p className="whitespace-pre-wrap text-[13px] leading-[1.72] text-white/75">{chapter.script}</p><div className="mt-3 rounded-lg border border-amber-300/10 bg-amber-400/[.04] px-2.5 py-2 text-[10px] leading-relaxed"><span className="mr-2 font-bold tracking-[.12em] text-amber-300/75">RETENTION</span><span className="text-white/45">{chapter.retention_device}</span></div></div>
      </article>)}</div>
      <div className="mt-3 rounded-xl border border-emerald-300/15 bg-emerald-400/[.055] p-3"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-emerald-300">Final payoff</p><p className="mt-1.5 text-[13px] leading-relaxed text-white/70">{data.final_payoff}</p></div>
      <div className="mt-2 rounded-xl border border-cyan-300/15 bg-cyan-400/[.05] p-3"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-cyan-300">Watch next bridge</p><p className="mt-1.5 text-[13px] leading-relaxed text-white/70">{data.watch_next_bridge}</p></div>
    </div> : tab === "production" ? <div className="space-y-3 p-4">
      <Panel icon={<Gift size={15} weight="duotone" />} label="Payoff map" accent="text-amber-300"><ol className="space-y-2">{data.payoff_map.map((item, index) => <li key={index} className="flex gap-2 text-[12px] leading-relaxed text-white/60"><span className="font-mono text-[9px] text-amber-300/45">{String(index + 1).padStart(2, "0")}</span>{item}</li>)}</ol></Panel>
      <Panel icon={<PlayCircle size={15} />} label="Mid-video subscribe line" accent="text-fuchsia-300"><p className="text-[12px] leading-relaxed text-white/65">{data.subscribe_line}</p></Panel>
      <Panel icon={<PresentationChart size={15} />} label="Production notes" accent="text-cyan-300"><ul className="space-y-2">{data.production_notes.map((item, index) => <li key={index} className="flex gap-2 text-[12px] leading-relaxed text-white/60"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan-300/60" />{item}</li>)}</ul></Panel>
      <div className="space-y-2">{data.chapters.map((chapter) => <div key={chapter.n} className="rounded-xl border border-white/[.07] bg-white/[.03] p-3"><div className="flex items-center justify-between"><span className="text-[10px] font-medium text-white/65">{chapter.title}</span><span className="font-mono text-[9px] text-white/25">{chapter.timecode}</span></div><ul className="mt-2 space-y-1.5">{chapter.visuals.map((visual, index) => <li key={index} className="flex gap-2 text-[10px] leading-relaxed text-white/40"><span className="text-cyan-300/50">SHOT</span>{visual}</li>)}</ul></div>)}</div>
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
