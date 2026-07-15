"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowsClockwise, Check, CircleNotch, Copy, DownloadSimple, Image as ImageIcon, Palette, Warning } from "@phosphor-icons/react";
import type { PicturePostArtifactData } from "@/lib/jarvis-events";
import { CAROUSEL_QUALITY_KEY, normalizeCarouselQuality, type CarouselImageQuality } from "@/lib/carousel-settings";
import { ASPECT_HINT, type PostAspect } from "@/lib/post-image";
import { DeliverableEyebrow } from "./DeliverableEyebrow";

const ASPECTS: PostAspect[] = ["square", "portrait", "landscape"];
const ASPECT_RATIO: Record<PostAspect, string> = { square: "1 / 1", portrait: "4 / 5", landscape: "1.91 / 1" };

export default function PicturePostArtifact({ data }: { data: PicturePostArtifactData }) {
  const [aspect, setAspect] = useState<PostAspect>(data.aspect);
  const [quality, setQuality] = useState<CarouselImageQuality>("high");
  const [image, setImage] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const nonce = useRef(0);

  useEffect(() => {
    setQuality(normalizeCarouselQuality(typeof window !== "undefined" ? window.localStorage.getItem(CAROUSEL_QUALITY_KEY) : "high"));
  }, []);

  const generate = useCallback(async () => {
    const run = ++nonce.current;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/post/image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ concept: data.concept, image_prompt: data.image_prompt, style: data.style, aspect, on_image_text: data.on_image_text, quality }),
      });
      const json = await res.json();
      if (nonce.current !== run) return;
      if (!res.ok || !json.image) throw new Error(json.error || "Image generation failed.");
      setImage(json.image);
      setStatus("ready");
    } catch (error) {
      if (nonce.current !== run) return;
      setErrorMsg(error instanceof Error ? error.message : "Image generation failed.");
      setStatus("error");
    }
  }, [data.concept, data.image_prompt, data.style, data.on_image_text, aspect, quality]);

  useEffect(() => { void generate(); }, [generate]);

  const caption = data.caption + (data.hashtags.length ? "\n\n" + data.hashtags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ") : "");
  const copyCaption = async () => {
    await navigator.clipboard.writeText(caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const downloadImage = () => {
    if (!image) return;
    const anchor = document.createElement("a");
    anchor.href = image;
    anchor.download = `${(data.concept || "image-post").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "image-post"}.png`;
    anchor.click();
  };

  return <div className="h-full overflow-y-auto bg-[#060811] text-white">
    <div className="sticky top-0 z-20 border-b border-white/[.07] bg-[#080a13]/90 px-4 py-3 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <DeliverableEyebrow />
        <div className="flex gap-1.5">
          <button onClick={() => void generate()} aria-label="Regenerate image" title="Regenerate" className="rounded-lg border border-white/10 bg-white/[.05] p-2 text-white/55 transition hover:bg-white/10 hover:text-white"><ArrowsClockwise size={15} /></button>
          <button onClick={downloadImage} disabled={!image} aria-label="Download image" title="Download PNG" className="rounded-lg border border-white/10 bg-white/[.05] p-2 text-white/55 transition hover:bg-white/10 hover:text-white disabled:opacity-40"><DownloadSimple size={15} /></button>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[.18em] text-violet-300"><span className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-400/10"><ImageIcon size={11} weight="fill" /></span>Single-image post</div>
        <p className="mt-1.5 text-[13px] leading-snug text-white/80">{data.concept}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-md border border-violet-300/20 bg-violet-400/[.08] px-2 py-1 text-[10px] font-medium text-violet-100/80">{data.platform}</span>
          <span className="flex items-center gap-1 rounded-md border border-white/[.08] bg-white/[.04] px-2 py-1 text-[10px] text-white/55"><Palette size={11} />{prettyStyle(data.style)}</span>
          {data.on_image_text ? <span className="rounded-md border border-white/[.08] bg-white/[.04] px-2 py-1 text-[10px] text-white/45">on-image: “{data.on_image_text}”</span> : null}
        </div>
      </div>
    </div>

    <div className="p-4">
      {/* Image stage */}
      <div className="relative mx-auto overflow-hidden rounded-2xl border border-white/[.09] bg-black/40" style={{ aspectRatio: ASPECT_RATIO[aspect], maxWidth: aspect === "landscape" ? "100%" : aspect === "square" ? "420px" : "360px" }}>
        {status === "ready" && image ? <img src={image} alt={data.concept} className="h-full w-full object-cover" /> : null}
        {status === "loading" ? <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#080a13]">
          <div className="relative"><CircleNotch size={30} className="animate-spin text-violet-300" /></div>
          <p className="text-[11px] text-white/45">Rendering with GPT Image 2…</p>
        </div> : null}
        {status === "error" ? <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#080a13] px-6 text-center">
          <Warning size={26} className="text-rose-300" />
          <p className="text-[11px] leading-relaxed text-white/50">{errorMsg}</p>
          <button onClick={() => void generate()} className="rounded-lg border border-white/15 bg-white/[.06] px-3 py-1.5 text-[11px] font-medium text-white/80 transition hover:bg-white/10">Try again</button>
        </div> : null}
      </div>

      {/* Aspect + quality controls */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-black/25 p-1">
          {ASPECTS.map((item) => <button key={item} onClick={() => setAspect(item)} title={ASPECT_HINT[item]} className={`rounded-md px-2.5 py-1 text-[10px] font-semibold capitalize transition ${aspect === item ? "bg-white/10 text-white" : "text-white/35 hover:text-white/65"}`}>{item}</button>)}
        </div>
        <div className="flex rounded-lg bg-black/25 p-1">
          {(["low", "medium", "high"] as CarouselImageQuality[]).map((item) => <button key={item} onClick={() => setQuality(item)} className={`rounded-md px-2.5 py-1 text-[10px] font-semibold capitalize transition ${quality === item ? "bg-white/10 text-white" : "text-white/35 hover:text-white/65"}`}>{item}</button>)}
        </div>
      </div>

      {/* Caption */}
      <div className="mt-4 rounded-2xl border border-white/[.09] bg-white/[.04]">
        <div className="flex items-center justify-between border-b border-white/[.06] px-4 py-2.5">
          <p className="text-[9px] font-bold uppercase tracking-[.18em] text-white/40">Caption</p>
          <button onClick={copyCaption} className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[.05] px-2 py-1 text-[10px] text-white/55 transition hover:bg-white/10 hover:text-white">{copied ? <><Check size={12} className="text-emerald-300" />Copied</> : <><Copy size={12} />Copy</>}</button>
        </div>
        <div className="px-4 py-3.5">
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/80">{data.caption}</p>
          {data.hashtags.length ? <p className="mt-3 flex flex-wrap gap-1.5">{data.hashtags.map((tag) => <span key={tag} className="text-[12px] font-medium text-violet-300/80">#{tag.replace(/^#/, "")}</span>)}</p> : null}
        </div>
      </div>

      {data.cta ? <div className="mt-2 rounded-xl border border-emerald-300/15 bg-emerald-400/[.06] p-3"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-emerald-300">Call to action</p><p className="mt-1.5 text-[13px] leading-relaxed text-white/75">{data.cta}</p></div> : null}

      {data.grounding.length ? <div className="mt-2 rounded-xl border border-white/[.06] p-3"><p className="text-[9px] font-semibold uppercase tracking-[.18em] text-white/30">Grounded in</p><div className="mt-2 flex flex-wrap gap-1.5">{data.grounding.map((item) => <span key={item} className="rounded-md bg-violet-400/[.07] px-2 py-1 text-[9px] text-violet-100/55">{item}</span>)}</div></div> : null}
    </div>
  </div>;
}

function prettyStyle(style: string) {
  return style.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
