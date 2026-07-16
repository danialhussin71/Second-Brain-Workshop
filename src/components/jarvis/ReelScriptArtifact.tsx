"use client";

import { useMemo, useState } from "react";
import { Check, Copy, DownloadSimple, FilmStrip, MicrophoneStage, Play } from "@phosphor-icons/react";
import type { ReelArtifactData, ReelBeat, ReelBeatRole } from "@/lib/jarvis-events";
import { DeliverableEyebrow } from "./DeliverableEyebrow";

type Tab = "script" | "production";

/** Beat roles, in running order, with the accent that carries them through the UI. */
const ROLE: Record<ReelBeatRole, { label: string; accent: string; dot: string }> = {
  hook: { label: "Hook", accent: "text-fuchsia-300", dot: "bg-fuchsia-300" },
  rehook: { label: "Rehook", accent: "text-violet-300", dot: "bg-violet-300" },
  body: { label: "Body", accent: "text-cyan-300", dot: "bg-cyan-300" },
  payoff: { label: "Payoff", accent: "text-amber-300", dot: "bg-amber-300" },
  cta: { label: "Call to action", accent: "text-emerald-300", dot: "bg-emerald-300" },
};

const roleOf = (beat: ReelBeat, index: number): ReelBeatRole => beat.role || (index === 0 ? "hook" : "body");

/** One sentence per line — the writer emits them newline-separated. */
const lines = (spoken: string) => spoken.split("\n").map((line) => line.trim()).filter(Boolean);

/** The teleprompter export: just the words, blank line between beats. */
function spokenScript(data: ReelArtifactData) {
  return data.beats.map((beat) => lines(beat.spoken).join("\n")).join("\n\n");
}

/** The full export, script plus the production notes. */
function fullScript(data: ReelArtifactData) {
  return [
    data.title,
    `${data.platform} | ${data.duration_seconds}s | ${data.word_count} words`,
    "",
    spokenScript(data),
    "",
    "— PRODUCTION —",
    ...data.beats.map((beat, index) => `\n${ROLE[roleOf(beat, index)].label.toUpperCase()} · ${beat.timecode}\n[VISUAL: ${beat.visual}]\n[ON SCREEN: ${beat.onscreen_text}]\n[EDIT: ${beat.edit}]`),
    `\nCAPTION\n${data.caption}`,
  ].join("\n");
}

export default function ReelScriptArtifact({ data }: { data: ReelArtifactData }) {
  const [tab, setTab] = useState<Tab>("script");
  const [copied, setCopied] = useState(false);
  // On the script tab, copy exactly what is on screen: the spoken words only.
  const copy = async () => {
    await navigator.clipboard.writeText(tab === "script" ? spokenScript(data) : fullScript(data));
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
  const elapsed = useMemo(() => data.beats.reduce((sum, beat) => sum + beat.duration_seconds, 0), [data.beats]);

  return <div className="h-full overflow-y-auto bg-[#060811] text-white">
    <div className="sticky top-0 z-20 border-b border-white/[.07] bg-[#080a13]/90 px-4 py-3 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <DeliverableEyebrow />
        <div className="flex gap-1.5">
          <button onClick={copy} aria-label={tab === "script" ? "Copy the spoken script" : "Copy script and production notes"} title={tab === "script" ? "Copy the spoken script" : "Copy script and production notes"} className="rounded-lg border border-white/10 bg-white/[.05] p-2 text-white/55 transition hover:bg-white/10 hover:text-white">{copied ? <Check size={15} className="text-emerald-300" /> : <Copy size={15} />}</button>
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

    {tab === "script" ? (
      /* The teleprompter: only the words, one sentence per line. */
      <div className="px-4 py-5">
        <div className="space-y-6">
          {data.beats.map((beat, index) => {
            const role = ROLE[roleOf(beat, index)];
            return <section key={`${beat.timecode}-${index}`} className="relative pl-5">
              <span className={`absolute left-0 top-[7px] h-1.5 w-1.5 rounded-full ${role.dot}`} />
              <span className={`absolute bottom-1 left-[2.5px] top-[18px] w-px bg-gradient-to-b ${index === data.beats.length - 1 ? "from-white/10 to-transparent" : "from-white/10 to-white/[.04]"}`} />
              <div className={`text-[9px] font-bold uppercase tracking-[.2em] ${role.accent}`}>{role.label}</div>
              <div className="mt-2.5 space-y-2">
                {lines(beat.spoken).map((line, lineIndex) => (
                  <p key={lineIndex} className="text-[16px] font-medium leading-[1.5] tracking-[-.011em] text-white/90">{line}</p>
                ))}
              </div>
            </section>;
          })}
        </div>
      </div>
    ) : (
      <div className="space-y-3 p-4">
        {/* Per-beat visual direction lives here, off the script page. */}
        <div className="rounded-xl border border-white/[.075] bg-white/[.035] p-3.5">
          <div className="flex items-center justify-between text-cyan-300">
            <div className="flex items-center gap-2"><FilmStrip size={16} /><span className="text-[9px] font-bold uppercase tracking-[.18em]">Beat direction</span></div>
            <span className="text-[9px] text-white/30">{elapsed}s planned</span>
          </div>
          <div className="mt-3 space-y-2.5">
            {data.beats.map((beat, index) => {
              const role = ROLE[roleOf(beat, index)];
              return <div key={`${beat.timecode}-${index}`} className="rounded-lg border border-white/[.06] bg-black/20 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[9px] font-bold uppercase tracking-[.16em] ${role.accent}`}>{role.label}</span>
                  <span className="flex items-center gap-2"><span className="font-mono text-[10px] text-white/40">{beat.timecode}</span><span className="rounded-full bg-white/[.06] px-1.5 py-0.5 text-[9px] text-white/35">{beat.duration_seconds}s</span></span>
                </div>
                <div className="mt-2 space-y-1.5 text-[10px] leading-relaxed">
                  <p><span className="mr-2 text-cyan-300/70">VISUAL</span><span className="text-white/50">{beat.visual}</span></p>
                  <p><span className="mr-2 text-amber-300/70">TEXT</span><span className="text-white/50">{beat.onscreen_text || "None"}</span></p>
                  <p><span className="mr-2 text-emerald-300/70">EDIT</span><span className="text-white/50">{beat.edit}</span></p>
                </div>
              </div>;
            })}
          </div>
        </div>
        <ProductionCard icon={<MicrophoneStage size={16} />} label="Delivery" text={data.production.delivery} accent="text-fuchsia-300" />
        <ProductionCard icon={<FilmStrip size={16} />} label="Edit and music" text={`${data.production.music}\n\nCaptions: ${data.production.captions}`} accent="text-cyan-300" />
        <div className="rounded-xl border border-white/[.075] bg-white/[.035] p-3.5"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-amber-300">Shot list</p><ol className="mt-3 space-y-2">{data.production.shot_list.map((shot, index) => <li key={index} className="flex gap-2 text-[12px] leading-relaxed text-white/60"><span className="font-mono text-[10px] text-white/25">{String(index + 1).padStart(2, "0")}</span>{shot}</li>)}</ol></div>
        <div className="rounded-xl border border-white/[.07] bg-white/[.025] p-3.5"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-white/35">Posting caption</p><p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-white/60">{data.caption}</p></div>
        {data.grounding.length ? <div className="rounded-xl border border-white/[.06] p-3"><p className="text-[9px] font-semibold uppercase tracking-[.18em] text-white/30">Grounded in</p><div className="mt-2 flex flex-wrap gap-1.5">{data.grounding.map((item) => <span key={item} className="rounded-md bg-cyan-400/[.07] px-2 py-1 text-[9px] text-cyan-100/55">{item}</span>)}</div></div> : null}
      </div>
    )}
  </div>;
}

function ProductionCard({ icon, label, text, accent }: { icon: React.ReactNode; label: string; text: string; accent: string }) {
  return <div className="rounded-xl border border-white/[.075] bg-white/[.035] p-3.5"><div className={`flex items-center gap-2 ${accent}`}>{icon}<span className="text-[9px] font-bold uppercase tracking-[.18em]">{label}</span></div><p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-white/60">{text}</p></div>;
}
