"use client";

import { useMemo, useState } from "react";
import { ArrowsClockwise, Check, ChatCircle, Copy, DownloadSimple, Hash, Heart, PaperPlaneTilt, PenNib, Repeat, ThumbsUp } from "@phosphor-icons/react";
import type { TextPostArtifactData } from "@/lib/jarvis-events";
import { DeliverableEyebrow } from "./DeliverableEyebrow";

const ANGLE_LABEL: Record<TextPostArtifactData["angle"], string> = {
  standard: "Standard",
  story: "Story",
  framework: "Framework",
  contrarian: "Contrarian",
};

/** Swap the first line (hook) of the body for a chosen alternative hook. */
function withHook(body: string, oldHook: string, newHook: string) {
  const trimmed = body.trimStart();
  if (trimmed.startsWith(oldHook)) return newHook + body.slice(body.indexOf(oldHook) + oldHook.length);
  const lines = body.split("\n");
  lines[0] = newHook;
  return lines.join("\n");
}

export default function TextPostArtifact({ data }: { data: TextPostArtifactData }) {
  const [hook, setHook] = useState(data.hook);
  const [copied, setCopied] = useState(false);

  const body = useMemo(() => (hook === data.hook ? data.body : withHook(data.body, data.hook, hook)), [hook, data.body, data.hook]);
  const hashtagLine = data.hashtags.length ? "\n\n" + data.hashtags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ") : "";
  const fullText = body + hashtagLine;
  const chars = fullText.length;

  const copy = async () => {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const download = () => {
    const blob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(hook || "text-post").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "text-post"}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return <div className="h-full overflow-y-auto bg-[#060811] text-white">
    <div className="sticky top-0 z-20 border-b border-white/[.07] bg-[#080a13]/90 px-4 py-3 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <DeliverableEyebrow />
        <div className="flex gap-1.5">
          <button onClick={copy} aria-label="Copy post" className="rounded-lg border border-white/10 bg-white/[.05] p-2 text-white/55 transition hover:bg-white/10 hover:text-white">{copied ? <Check size={15} className="text-emerald-300" /> : <Copy size={15} />}</button>
          <button onClick={download} aria-label="Download text" title="Download plain text" className="rounded-lg border border-white/10 bg-white/[.05] p-2 text-white/55 transition hover:bg-white/10 hover:text-white"><DownloadSimple size={15} /></button>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[.18em] text-cyan-300"><span className="flex h-5 w-5 items-center justify-center rounded-md bg-cyan-400/10"><PenNib size={11} weight="fill" /></span>Text post</div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-md border border-cyan-300/20 bg-cyan-400/[.08] px-2 py-1 text-[10px] font-medium text-cyan-100/80">{data.platform}</span>
          <span className="rounded-md border border-white/[.08] bg-white/[.04] px-2 py-1 text-[10px] text-white/55">{ANGLE_LABEL[data.angle]} angle</span>
          <span className="rounded-md border border-white/[.08] bg-white/[.04] px-2 py-1 text-[10px] text-white/45">{chars} chars</span>
        </div>
      </div>
    </div>

    <div className="p-4">
      {/* Post preview — styled like a real social composer */}
      <div className="overflow-hidden rounded-2xl border border-white/[.09] bg-white/[.04] shadow-[0_20px_55px_-38px_rgba(34,211,238,.6)]">
        <div className="flex items-center gap-2.5 border-b border-white/[.06] px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/30 to-violet-400/20 text-[13px] font-bold text-white">You</div>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-white/90">Your brand</p>
            <p className="text-[10px] text-white/35">{data.platform} · now</p>
          </div>
        </div>
        <div className="px-4 py-3.5">
          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-white/85">{body}</p>
          {data.hashtags.length ? <p className="mt-3 flex flex-wrap gap-1.5">{data.hashtags.map((tag) => <span key={tag} className="text-[12px] font-medium text-cyan-300/80">#{tag.replace(/^#/, "")}</span>)}</p> : null}
        </div>
        <div className="flex items-center justify-around border-t border-white/[.06] px-4 py-2 text-white/30">
          <span className="flex items-center gap-1.5 text-[11px]"><ThumbsUp size={14} />Like</span>
          <span className="flex items-center gap-1.5 text-[11px]"><ChatCircle size={14} />Comment</span>
          <span className="flex items-center gap-1.5 text-[11px]"><Repeat size={14} />Repost</span>
          <span className="flex items-center gap-1.5 text-[11px]"><PaperPlaneTilt size={14} />Send</span>
        </div>
      </div>

      {/* Alternative hooks — click to swap the opening line */}
      {data.alt_hooks.length ? <div className="mt-4">
        <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.18em] text-white/35"><ArrowsClockwise size={12} />Swap the hook</p>
        <div className="mt-2 space-y-1.5">
          {[data.hook, ...data.alt_hooks].map((option, index) => <button key={index} onClick={() => setHook(option)} className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left text-[12px] leading-snug transition ${hook === option ? "border-cyan-300/40 bg-cyan-400/[.09] text-white" : "border-white/[.07] bg-white/[.025] text-white/55 hover:border-white/15 hover:text-white/80"}`}>
            <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold ${hook === option ? "bg-cyan-400 text-[#04121a]" : "bg-white/10 text-white/40"}`}>{hook === option ? "✓" : index === 0 ? "A" : String.fromCharCode(65 + index)}</span>
            <span>{option}{index === 0 ? <span className="ml-1.5 text-[9px] uppercase tracking-wider text-white/25">original</span> : null}</span>
          </button>)}
        </div>
      </div> : null}

      {data.cta ? <div className="mt-4 rounded-xl border border-emerald-300/15 bg-emerald-400/[.06] p-3"><p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.18em] text-emerald-300"><Heart size={12} weight="fill" />Call to action</p><p className="mt-1.5 text-[13px] leading-relaxed text-white/75">{data.cta}</p></div> : null}

      {data.hashtags.length ? <div className="mt-2 rounded-xl border border-white/[.07] bg-white/[.025] p-3"><p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.18em] text-white/35"><Hash size={12} />Hashtags</p><div className="mt-2 flex flex-wrap gap-1.5">{data.hashtags.map((tag) => <span key={tag} className="rounded-md bg-white/[.05] px-2 py-1 text-[11px] text-white/55">#{tag.replace(/^#/, "")}</span>)}</div></div> : null}

      {data.grounding.length ? <div className="mt-2 rounded-xl border border-white/[.06] p-3"><p className="text-[9px] font-semibold uppercase tracking-[.18em] text-white/30">Grounded in</p><div className="mt-2 flex flex-wrap gap-1.5">{data.grounding.map((item) => <span key={item} className="rounded-md bg-cyan-400/[.07] px-2 py-1 text-[9px] text-cyan-100/55">{item}</span>)}</div></div> : null}
    </div>
  </div>;
}
