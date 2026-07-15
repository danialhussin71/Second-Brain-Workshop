"use client";

import { useMemo, useState } from "react";
import { Check, Copy, DownloadSimple, FilePdf, FilmStrip, MicrophoneStage, Play, Sparkle } from "@phosphor-icons/react";
import type { ReelArtifactData } from "@/lib/jarvis-events";
import { DeliverableEyebrow } from "./DeliverableEyebrow";

type Tab = "script" | "production";

function fullScript(data: ReelArtifactData) {
  return [
    data.title,
    `${data.platform} | ${data.duration_seconds}s | ${data.word_count} words`,
    "",
    ...data.beats.map((beat, index) => `\n${index === 0 ? "HOOK\n" : ""}${beat.timecode}\n${beat.spoken}\n[VISUAL: ${beat.visual}]\n[ON SCREEN: ${beat.onscreen_text}]\n[EDIT: ${beat.edit}]`),
    `\nCAPTION\n${data.caption}`,
  ].join("\n");
}

export default function ReelScriptArtifact({ data }: { data: ReelArtifactData }) {
  const [tab, setTab] = useState<Tab>("script");
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(fullScript(data));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const download = () => {
    const blob = new Blob([fullScript(data)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "reel-script"}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const downloadAsPdf = async () => {
    const { createReelScriptPdf, downloadPdf } = await import("@/lib/script-pdf");
    downloadPdf(await createReelScriptPdf(data), data.title);
  };
  const elapsed = useMemo(() => data.beats.reduce((sum, beat) => sum + beat.duration_seconds, 0), [data.beats]);

  return <div className="h-full overflow-y-auto bg-[#060811] text-white">
    <div className="sticky top-0 z-20 border-b border-white/[.07] bg-[#080a13]/90 px-4 py-3 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <DeliverableEyebrow />
        <div className="flex gap-1.5">
          <button onClick={copy} aria-label="Copy full script" className="rounded-lg border border-white/10 bg-white/[.05] p-2 text-white/55 transition hover:bg-white/10 hover:text-white">{copied ? <Check size={15} className="text-emerald-300" /> : <Copy size={15} />}</button>
          <button onClick={downloadAsPdf} aria-label="Download PDF" title="Download branded PDF" className="rounded-lg border border-white/10 bg-white/[.05] p-2 text-white/55 transition hover:bg-white/10 hover:text-white"><FilePdf size={15} /></button>
          <button onClick={download} aria-label="Download text file" title="Download plain text" className="rounded-lg border border-white/10 bg-white/[.05] p-2 text-white/55 transition hover:bg-white/10 hover:text-white"><DownloadSimple size={15} /></button>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[.18em] text-fuchsia-300"><span className="flex h-5 w-5 items-center justify-center rounded-md bg-fuchsia-400/10"><Play size={10} weight="fill" /></span>Reel production script</div>
        <h2 className="mt-1.5 text-xl font-semibold leading-tight tracking-[-.02em]">{data.title}</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-white/45">{data.objective}</p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {[data.platform, `${data.duration_seconds} sec`, `${data.word_count} words`].map((value) => <div key={value} className="rounded-lg border border-white/[.07] bg-white/[.035] px-2 py-1.5 text-center text-[10px] text-white/60">{value}</div>)}
      </div>
      <div className="mt-3 flex rounded-lg bg-black/25 p-1">
        {(["script", "production"] as Tab[]).map((item) => <button key={item} onClick={() => setTab(item)} className={`flex-1 rounded-md px-3 py-1.5 text-[10px] font-semibold capitalize transition ${tab === item ? "bg-white/10 text-white shadow-sm" : "text-white/35 hover:text-white/65"}`}>{item}</button>)}
      </div>
    </div>

    {tab === "script" ? <div className="p-4">
      <div className="relative overflow-hidden rounded-2xl border border-fuchsia-300/20 bg-gradient-to-br from-fuchsia-400/[.12] via-purple-400/[.06] to-transparent p-4 shadow-[0_20px_55px_-35px_rgba(217,70,239,.8)]">
        <div className="absolute -right-6 -top-7 h-24 w-24 rounded-full bg-fuchsia-400/10 blur-2xl" />
        <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.2em] text-fuchsia-300"><Sparkle size={12} weight="fill" />0:00 · Triple hook</div>
        <p className="mt-3 text-[17px] font-medium leading-snug text-white">{data.hook.spoken}</p>
        <div className="mt-4 grid gap-2 text-[11px]">
          <div className="rounded-lg bg-black/20 p-2.5"><span className="text-white/35">FIRST FRAME</span><p className="mt-1 text-white/65">{data.hook.visual}</p></div>
          <div className="rounded-lg bg-black/20 p-2.5"><span className="text-white/35">ON SCREEN</span><p className="mt-1 font-medium text-fuchsia-100/80">{data.hook.onscreen_text}</p></div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2"><div className="h-px flex-1 bg-gradient-to-r from-fuchsia-400/40 to-transparent" /><span className="text-[9px] font-semibold uppercase tracking-[.2em] text-white/30">Timeline · {elapsed}s planned</span></div>
      <div className="relative mt-3 space-y-2.5 before:absolute before:bottom-4 before:left-[23px] before:top-4 before:w-px before:bg-gradient-to-b before:from-fuchsia-400/50 before:via-cyan-400/30 before:to-emerald-400/30">
        {data.beats.map((beat, index) => <div key={`${beat.timecode}-${index}`} className="relative pl-12">
          <span className="absolute left-[17px] top-4 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-fuchsia-300/50 bg-[#080a13]"><span className="h-1 w-1 rounded-full bg-fuchsia-300" /></span>
          <div className="rounded-xl border border-white/[.075] bg-white/[.035] p-3 transition hover:border-white/15 hover:bg-white/[.05]">
            <div className="flex items-center justify-between gap-2"><span className="font-mono text-[10px] text-fuchsia-300">{beat.timecode}</span><span className="rounded-full bg-white/[.05] px-2 py-0.5 text-[9px] text-white/35">{beat.duration_seconds}s</span></div>
            <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-white/85">{beat.spoken}</p>
            <div className="mt-3 space-y-1.5 border-t border-white/[.06] pt-2.5 text-[10px] leading-relaxed">
              <p><span className="mr-2 text-cyan-300/70">VISUAL</span><span className="text-white/45">{beat.visual}</span></p>
              <p><span className="mr-2 text-amber-300/70">TEXT</span><span className="text-white/45">{beat.onscreen_text || "None"}</span></p>
              <p><span className="mr-2 text-emerald-300/70">EDIT</span><span className="text-white/45">{beat.edit}</span></p>
            </div>
          </div>
        </div>)}
      </div>
      <div className="mt-4 rounded-xl border border-emerald-300/15 bg-emerald-400/[.06] p-3"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-emerald-300">CTA</p><p className="mt-1.5 text-[13px] leading-relaxed text-white/75">{data.cta}</p></div>
      <div className="mt-2 rounded-xl border border-white/[.07] bg-white/[.025] p-3"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-white/35">Posting caption</p><p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-white/60">{data.caption}</p></div>
    </div> : <div className="space-y-3 p-4">
      <ProductionCard icon={<MicrophoneStage size={16} />} label="Delivery" text={data.production.delivery} accent="text-fuchsia-300" />
      <ProductionCard icon={<FilmStrip size={16} />} label="Edit and music" text={`${data.production.music}\n\nCaptions: ${data.production.captions}`} accent="text-cyan-300" />
      <div className="rounded-xl border border-white/[.075] bg-white/[.035] p-3.5"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-amber-300">Shot list</p><ol className="mt-3 space-y-2">{data.production.shot_list.map((shot, index) => <li key={index} className="flex gap-2 text-[12px] leading-relaxed text-white/60"><span className="font-mono text-[10px] text-white/25">{String(index + 1).padStart(2, "0")}</span>{shot}</li>)}</ol></div>
      {data.grounding.length ? <div className="rounded-xl border border-white/[.06] p-3"><p className="text-[9px] font-semibold uppercase tracking-[.18em] text-white/30">Grounded in</p><div className="mt-2 flex flex-wrap gap-1.5">{data.grounding.map((item) => <span key={item} className="rounded-md bg-cyan-400/[.07] px-2 py-1 text-[9px] text-cyan-100/55">{item}</span>)}</div></div> : null}
    </div>}
  </div>;
}

function ProductionCard({ icon, label, text, accent }: { icon: React.ReactNode; label: string; text: string; accent: string }) {
  return <div className="rounded-xl border border-white/[.075] bg-white/[.035] p-3.5"><div className={`flex items-center gap-2 ${accent}`}>{icon}<span className="text-[9px] font-bold uppercase tracking-[.18em]">{label}</span></div><p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-white/60">{text}</p></div>;
}
