"use client";

import { useEffect, useState } from "react";
import { DownloadSimple, Copy, Check } from "@phosphor-icons/react";
import type { NewsletterArtifactData } from "@/lib/jarvis-events";
import { DeliverableEyebrow } from "./DeliverableEyebrow";

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "newsletter";

/**
 * Renders the finished, light-themed HTML newsletter inside an isolated iframe (so
 * its email styles never collide with the dark app), with copy-HTML + download.
 */
export default function NewsletterArtifact({ data }: { data: NewsletterArtifactData }) {
  const [copied, setCopied] = useState(false);
  // the iframe can take a beat to paint a big HTML email — show a loader until it does
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setLoaded(false);
    const t = setTimeout(() => setLoaded(true), 8000); // safety net if onLoad never fires
    return () => clearTimeout(t);
  }, [data.html]);

  const copyHtml = async () => {
    try {
      await navigator.clipboard.writeText(data.html);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  const download = () => {
    const blob = new Blob([data.html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(data.subject)}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const btn =
    "flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.05] px-2.5 py-1.5 text-[11.5px] font-medium text-white/75 transition hover:border-fuchsia-300/40 hover:text-white";

  return (
    <div className="flex h-full flex-col">
      {/* subject bar */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-2.5">
        <div className="min-w-0">
          <DeliverableEyebrow />
          <div className="mt-0.5 truncate text-[13px] font-semibold text-white/90">{data.subject}</div>
          {data.preview && <div className="truncate text-[11px] text-white/40">{data.preview}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={copyHtml} className={btn} title="Copy the HTML">
            {copied ? <Check size={13} weight="bold" /> : <Copy size={13} weight="bold" />} HTML
          </button>
          <button onClick={download} className={btn} title="Download as .html">
            <DownloadSimple size={13} weight="bold" /> Download
          </button>
        </div>
      </div>

      {/* the email, rendered isolated on its own light canvas */}
      <div className="relative min-h-0 flex-1 overflow-hidden p-3">
        <iframe
          title="Newsletter preview"
          srcDoc={data.html}
          sandbox="allow-same-origin"
          onLoad={() => setLoaded(true)}
          className="h-full w-full rounded-xl border border-white/10 bg-white shadow-[0_18px_50px_-26px_rgba(0,0,0,0.7)]"
        />
        {!loaded && (
          <div className="absolute inset-3 flex flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-white">
            <div className="relative h-9 w-9">
              <div className="absolute inset-0 rounded-full border-2 border-slate-200" />
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-fuchsia-500" />
            </div>
            <div className="text-[12.5px] font-medium text-slate-500">Rendering the newsletter…</div>
          </div>
        )}
      </div>
    </div>
  );
}
