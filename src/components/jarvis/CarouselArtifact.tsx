"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { CaretLeft, CaretRight, Copy, Check, Sparkle, ArrowsOut, ArrowsIn, DownloadSimple, FilePdf, FileZip } from "@phosphor-icons/react";
import { zipSync } from "fflate";
import type { CarouselArtifactData } from "@/lib/jarvis-events";
import { CAROUSEL_QUALITY_KEY, normalizeCarouselQuality, type CarouselImageQuality } from "@/lib/carousel-settings";
import { cn } from "@/lib/utils";
import { DeliverableEyebrow } from "./DeliverableEyebrow";

/**
 * The carousel host — a cinematic, premium slide deck. A floating slide on an
 * accent-tinted stage (ambient bloom + floor glow + gradient-glass frame),
 * stories-style segmented progress, glassy spring-loaded controls, a refined
 * filmstrip, a polished caption dock, plus full-screen + download-all. All chrome
 * lives OFF the artwork.
 */

const KIND_TAG: Record<string, string> = { hook: "HOOK", body: "BUILD", cta: "CALL TO ACTION" };
const ACCENT: Record<string, string> = { hook: "#d946ef", body: "#a78bfa", cta: "#34d399" };
// founder brand crimson — drives the on-white controls + the card's elevation glow
const BRAND = "#ED1846";
const BRAND_INK = "#C20E38"; // a touch darker, for small text on white (AA contrast)

const variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir >= 0 ? 80 : -80, scale: 0.88, rotateY: dir >= 0 ? 12 : -12 }),
  center: { opacity: 1, x: 0, scale: 1, rotateY: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir >= 0 ? -80 : 80, scale: 0.88, rotateY: dir >= 0 ? -12 : 12 }),
};

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "carousel";
const pad = (n: number) => String(n).padStart(2, "0");

// Client-generated slide images, cached across mounts (so switching tabs doesn't
// re-render the whole deck) and de-duped while a request is in flight.
const carouselImageCache = new Map<string, string>();
const carouselInFlight = new Set<string>();
const slideCacheKey = (topic: string, idx: number, title: string, quality: CarouselImageQuality, brandRevision: number) => `${topic}::${idx}::${title}::${quality}::${brandRevision}`;

export default function CarouselArtifact({ data }: { data: CarouselArtifactData }) {
  const [[i, dir], setPos] = useState<[number, number]>([0, 0]);
  const [copied, setCopied] = useState(false);
  const [full, setFull] = useState(false);
  const [quality, setQuality] = useState<CarouselImageQuality>("high");
  const [brandRevision, setBrandRevision] = useState(0);
  // client-rendered slide images (idx → data URL) + per-slide status
  const [genImages, setGenImages] = useState<Record<number, string>>({});
  const [genState, setGenState] = useState<Record<number, "loading" | "error">>({});

  useEffect(() => {
    const sync = () => setQuality(normalizeCarouselQuality(window.localStorage.getItem(CAROUSEL_QUALITY_KEY)));
    sync();
    window.addEventListener("jarvis-carousel-quality", sync);
    return () => window.removeEventListener("jarvis-carousel-quality", sync);
  }, []);

  useEffect(() => {
    const refreshBrand = () => {
      carouselImageCache.clear();
      setGenImages({});
      setGenState({});
      setBrandRevision(Date.now());
    };
    window.addEventListener("jarvis-brand-updated", refreshBrand);
    return () => window.removeEventListener("jarvis-brand-updated", refreshBrand);
  }, []);

  useEffect(() => {
    setGenImages({});
    setGenState({});
  }, [quality]);

  // merge any server image (rare now) with the client-generated ones
  const slides = useMemo(
    () => data.slides.map((s, idx) => ({ ...s, image: s.image ?? genImages[idx] })),
    [data.slides, genImages]
  );
  const n = slides.length;
  const slide = slides[i];
  const accent = ACCENT[slide?.kind ?? "body"] ?? "#a78bfa";

  // Render ONE slide via the per-image endpoint, retrying up to 3× on failure.
  const genOne = useCallback(
    async (idx: number) => {
      const s = data.slides[idx];
      if (!s || s.image) return;
      const key = slideCacheKey(data.topic, idx, s.title, quality, brandRevision);
      const cached = carouselImageCache.get(key);
      if (cached) {
        setGenImages((p) => ({ ...p, [idx]: cached }));
        setGenState((p) => { const nx = { ...p }; delete nx[idx]; return nx; });
        return;
      }
      if (carouselInFlight.has(key)) return;
      carouselInFlight.add(key);
      setGenState((p) => ({ ...p, [idx]: "loading" }));
      try {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const res = await fetch("/api/carousel/image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                topic: data.topic,
                total: data.slides.length,
                styleBible: data.styleBible ?? "",
                quality,
                slide: { index: idx, kind: s.kind, title: s.title, body: s.body, layout: s.layout, visual: s.visual, logos: s.logos },
              }),
            });
            const j = (await res.json().catch(() => ({}))) as { image?: string };
            if (res.ok && j.image) {
              carouselImageCache.set(key, j.image);
              setGenImages((p) => ({ ...p, [idx]: j.image! }));
              setGenState((p) => { const nx = { ...p }; delete nx[idx]; return nx; });
              return;
            }
          } catch {
            /* network blip — fall through to the next attempt */
          }
          if (attempt < 3) await new Promise((r) => setTimeout(r, 700 * attempt));
        }
        setGenState((p) => ({ ...p, [idx]: "error" }));
      } finally {
        carouselInFlight.delete(key);
      }
    },
    [brandRevision, data, quality]
  );

  // Kick off generation for every slide missing an image (bounded concurrency).
  useEffect(() => {
    const needs = data.slides.map((_, idx) => idx).filter((idx) => {
      if (data.slides[idx].image) return false;
      const cached = carouselImageCache.get(slideCacheKey(data.topic, idx, data.slides[idx].title, quality, brandRevision));
      if (cached) {
        setGenImages((p) => (p[idx] ? p : { ...p, [idx]: cached }));
        return false;
      }
      return true;
    });
    if (!needs.length) return;
    const CONC = 2;
    let cursor = 0;
    const worker = async () => {
      while (cursor < needs.length) await genOne(needs[cursor++]);
    };
    Array.from({ length: Math.min(CONC, needs.length) }, () => worker());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandRevision, data, genOne, quality]);

  const clamp = (v: number) => Math.min(n - 1, Math.max(0, v));
  const go = (d: number) => setPos(([p]) => [clamp(p + d), d]);
  const jump = (to: number) => setPos(([p]) => [clamp(to), to >= p ? 1 : -1]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "Escape") setFull(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -70 || info.velocity.x < -400) go(1);
    else if (info.offset.x > 70 || info.velocity.x > 400) go(-1);
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(data.caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  const downloadAll = () => {
    const files: Record<string, Uint8Array> = {};
    slides.forEach((s, idx) => {
      if (!s.image || !s.image.startsWith("data:")) return;
      const b64 = s.image.split(",")[1] ?? "";
      try {
        files[`slide-${idx + 1}.png`] = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      } catch {
        /* skip */
      }
    });
    if (Object.keys(files).length === 0) return;
    save(zipSync(files), "zip");
  };

  // PDF deck — one slide per page at the image's native size. pdf-lib is loaded
  // lazily so it never weighs down the rest of the panel.
  const downloadPdf = async () => {
    const imgSlides = slides.filter((s) => s.image?.startsWith("data:"));
    if (!imgSlides.length) return;
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    for (const s of imgSlides) {
      try {
        const bytes = Uint8Array.from(atob(s.image!.split(",")[1] ?? ""), (c) => c.charCodeAt(0));
        const png = await doc.embedPng(bytes);
        const page = doc.addPage([png.width, png.height]);
        page.drawImage(png, { x: 0, y: 0, width: png.width, height: png.height });
      } catch {
        /* skip a bad slide */
      }
    }
    save(await doc.save(), "pdf");
  };

  const save = (bytes: Uint8Array, ext: "zip" | "pdf") => {
    const blob = new Blob([bytes as unknown as BlobPart], { type: ext === "pdf" ? "application/pdf" : "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(data.topic)}-carousel.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  /* ----- the cinematic slide stage ----- */
  const stage = (large: boolean) => (
    <div className={cn("relative flex min-h-0 flex-1 flex-col items-center gap-3.5 bg-white", large ? "px-6 py-5" : "px-3 py-4")} style={{ perspective: 1600 }}>
      <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
        <NavButton side="left" onClick={() => go(-1)} disabled={i === 0} />

        <div className={cn("relative aspect-[4/5] h-full w-auto", large ? "max-h-[80vh]" : "max-h-[600px]")}>
          {/* crimson ground glow so the slide floats warmly on the white stage */}
          <div
            className="pointer-events-none absolute -bottom-5 left-1/2 h-9 w-[84%] -translate-x-1/2 rounded-[50%]"
            style={{ background: "rgba(237,24,70,0.26)", filter: "blur(24px)" }}
          />
          <AnimatePresence custom={dir} mode="popLayout" initial={false}>
            <motion.div
              key={i}
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ x: { type: "spring", stiffness: 280, damping: 30 }, opacity: { duration: 0.22 }, scale: { duration: 0.32 } }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.16}
              onDragEnd={onDragEnd}
              className="absolute inset-0 cursor-grab overflow-hidden rounded-[22px] active:cursor-grabbing"
              style={{
                // image slides display on white; while a slide renders its tile is a dark crimson-tinted glass
                background: slide?.image
                  ? "#ffffff"
                  : "linear-gradient(157deg, rgba(32,36,55,0.94) 0%, rgba(11,13,24,0.96) 56%, rgba(28,11,19,0.97) 100%)",
                // layered elevation: crisp contact → soft ambient → deep crimson (brand) halo
                boxShadow:
                  "0 1px 2px rgba(15,23,42,0.10), 0 10px 26px -8px rgba(15,23,42,0.20), 0 34px 70px -30px rgba(237,24,70,0.34)",
              }}
            >
              {slide?.image ? (
                <motion.img
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  src={slide.image}
                  alt={slide.title}
                  draggable={false}
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="relative flex h-full flex-col items-center justify-center gap-4 overflow-hidden px-7 text-center">
                  {/* glass dressing — a crimson bloom + a hairline top sheen */}
                  <div
                    className="pointer-events-none absolute left-1/2 top-[16%] h-2/3 w-3/4 -translate-x-1/2 rounded-full"
                    style={{ background: "radial-gradient(circle, rgba(237,24,70,0.36), transparent 68%)", filter: "blur(36px)" }}
                  />
                  <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                  {genState[i] === "error" ? (
                    <>
                      <Sparkle size={26} weight="fill" style={{ color: BRAND }} className="relative opacity-90" />
                      <div className="relative text-[13px] text-white/75">This slide didn&apos;t render.</div>
                      <button
                        onClick={() => genOne(i)}
                        className="relative rounded-lg border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[12px] font-medium text-white/85 backdrop-blur transition hover:border-[#ED1846]/60 hover:text-white"
                      >
                        Retry slide
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="relative h-10 w-10">
                        <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                        <div
                          className="absolute inset-0 animate-spin rounded-full border-2 border-transparent"
                          style={{ borderTopColor: BRAND, borderRightColor: "rgba(237,24,70,0.45)", filter: "drop-shadow(0 0 7px rgba(237,24,70,0.65))" }}
                        />
                      </div>
                      <div className="relative text-[12.5px] font-medium text-white/80">
                        Rendering slide {i + 1} of {n}…
                      </div>
                      <div className="relative text-[11px] tracking-wide text-white/45">on-brand · gpt-image</div>
                    </>
                  )}
                </div>
              )}
              {/* hairline edge — faint dark on the white image, light on the dark glass tile */}
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 rounded-[22px] ring-1 ring-inset",
                  slide?.image ? "ring-black/[0.06]" : "ring-white/[0.10]"
                )}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        <NavButton side="right" onClick={() => go(1)} disabled={i === n - 1} />
      </div>

      {/* nav bar — a floating glass rail: kind · page dots · counter */}
      <div className="flex shrink-0 items-center gap-3 rounded-full border border-black/[0.06] bg-white/90 px-3.5 py-2 backdrop-blur-xl shadow-[0_2px_4px_rgba(15,23,42,0.04),0_14px_32px_-16px_rgba(15,23,42,0.28)]">
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em]"
          style={{ background: "rgba(237,24,70,0.10)", border: "1px solid rgba(237,24,70,0.28)", color: BRAND_INK }}
        >
          {KIND_TAG[slide?.kind ?? "body"]}
        </span>
        <div className="flex items-center gap-1.5">
          {data.slides.map((_, k) => (
            <button key={k} onClick={() => jump(k)} aria-label={`Slide ${k + 1}`} className="grid h-5 place-items-center">
              <motion.span
                className="block h-1.5 rounded-full"
                style={{ background: k === i ? BRAND : "rgba(237,24,70,0.22)", boxShadow: k === i ? `0 0 9px ${BRAND}99` : "none" }}
                initial={false}
                animate={{ width: k === i ? 22 : 6 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              />
            </button>
          ))}
        </div>
        <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums" style={{ color: BRAND_INK }}>
          {pad(i + 1)} <span style={{ color: "rgba(194,14,56,0.42)" }}>/ {pad(n)}</span>
        </span>
      </div>
    </div>
  );

  /* ----- premium filmstrip ----- */
  const filmstrip = (
    <div
      className="flex shrink-0 items-center gap-2.5 overflow-x-auto border-t border-white/8 px-4 py-3"
      style={{ maskImage: "linear-gradient(90deg, transparent, #000 16px, #000 calc(100% - 16px), transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 16px, #000 calc(100% - 16px), transparent)" }}
    >
      {slides.map((s, k) => {
        const a = ACCENT[s.kind] ?? "#a78bfa";
        const on = k === i;
        return (
          <motion.button
            key={k}
            onClick={() => jump(k)}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.94 }}
            className={cn("relative aspect-[4/5] h-14 shrink-0 overflow-hidden rounded-lg border transition", on ? "" : "opacity-45 hover:opacity-90")}
            style={{ borderColor: on ? a : "rgba(255,255,255,0.10)", boxShadow: on ? `0 6px 22px -8px ${a}99, 0 0 0 1.5px ${a}` : "none" }}
          >
            {s.image ? (
              <img src={s.image} alt="" draggable={false} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center p-1" style={{ background: `radial-gradient(120% 90% at 20% 0%, ${a}33, rgba(6,9,18,0.96) 65%)` }}>
                <span className="line-clamp-3 text-[7px] font-semibold leading-tight text-white/75">{s.title}</span>
              </div>
            )}
            <span className="absolute bottom-0.5 right-0.5 rounded bg-black/55 px-1 font-mono text-[7px] text-white/70">{k + 1}</span>
          </motion.button>
        );
      })}
    </div>
  );

  /* ----- caption dock ----- */
  const caption = (
    <div className="shrink-0 border-t border-white/8 px-4 py-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-white/40">
          <span className="h-1 w-1 rounded-full" style={{ background: accent }} />
          Post caption
        </span>
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[10px] text-white/30">{data.caption.length} chars</span>
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={copyCaption}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] backdrop-blur transition",
              copied ? "border-emerald-400/40 text-emerald-300" : "border-white/10 bg-white/[0.03] text-white/55 hover:border-fuchsia-300/40 hover:text-white"
            )}
          >
            {copied ? <Check size={12} weight="bold" /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy caption"}
          </motion.button>
        </div>
      </div>
      <p data-lenis-prevent className="max-h-[48px] overflow-y-auto whitespace-pre-line text-[12px] leading-relaxed text-white/60">
        {data.caption}
      </p>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 220, damping: 26 }} className="flex h-full flex-col">
      {/* header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/8 px-4 py-2">
        <div className="min-w-0">
          <DeliverableEyebrow />
          <div className="mt-0.5 truncate text-[13px] font-semibold tracking-tight text-white">{data.topic}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <GlassBtn label="Full screen" onClick={() => setFull(true)}>
            <ArrowsOut size={15} weight="bold" />
          </GlassBtn>
          <DownloadMenu onPdf={downloadPdf} onZip={downloadAll} />
        </div>
      </div>

      {stage(false)}
      {caption}

      {/* fullscreen */}
      {full &&
        typeof document !== "undefined" &&
        createPortal(
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex flex-col bg-[#02040a]/97 backdrop-blur-2xl"
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: `radial-gradient(60% 50% at 50% 42%, ${accent}1f, transparent 70%)` }}
            />
            <div className="relative flex shrink-0 items-center justify-between px-5 py-3.5">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-fuchsia-300/80">Carousel · {n} slides</div>
                <div className="truncate text-[16px] font-semibold tracking-tight text-white">{data.topic}</div>
              </div>
              <div className="flex items-center gap-2">
                <DownloadMenu onPdf={downloadPdf} onZip={downloadAll} variant="pill" />
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => setFull(false)} className="flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2 text-[12px] text-white/70 backdrop-blur transition hover:border-white/25 hover:text-white">
                  <ArrowsIn size={14} weight="bold" /> Close
                </motion.button>
              </div>
            </div>
            <div className="relative flex min-h-0 flex-1">{stage(true)}</div>
            <div className="relative mx-auto w-full max-w-3xl">{filmstrip}</div>
          </motion.div>,
          document.body
        )}
    </motion.div>
  );
}

function DownloadMenu({ onPdf, onZip, variant = "glass" }: { onPdf: () => void; onZip: () => void; variant?: "glass" | "pill" }) {
  const [open, setOpen] = useState(false);
  const item = "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] text-white/75 transition hover:bg-white/10 hover:text-white";
  return (
    <div className="relative">
      {variant === "pill" ? (
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2 text-[12px] text-white/70 backdrop-blur transition hover:border-white/25 hover:text-white">
          <DownloadSimple size={14} weight="bold" /> Download
        </motion.button>
      ) : (
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setOpen((v) => !v)} title="Download" className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/55 backdrop-blur transition hover:border-fuchsia-300/40 hover:bg-white/10 hover:text-white">
          <DownloadSimple size={15} weight="bold" />
        </motion.button>
      )}
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-[95]" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.16 }}
              className="absolute right-0 top-[calc(100%+6px)] z-[96] w-44 overflow-hidden rounded-xl border border-white/10 bg-[#0b0e16]/95 p-1 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl"
            >
              <button onClick={() => { setOpen(false); onPdf(); }} className={item}>
                <FilePdf size={15} weight="duotone" className="text-rose-300/80" /> PDF deck
              </button>
              <button onClick={() => { setOpen(false); onZip(); }} className={item}>
                <FileZip size={15} weight="duotone" className="text-amber-300/80" /> PNG slides (.zip)
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function GlassBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/55 backdrop-blur transition hover:border-fuchsia-300/40 hover:bg-white/10 hover:text-white"
    >
      {children}
    </motion.button>
  );
}

function NavButton({ side, onClick, disabled }: { side: "left" | "right"; onClick: () => void; disabled: boolean }) {
  const Icon = side === "left" ? CaretLeft : CaretRight;
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.07 }}
      whileTap={disabled ? undefined : { scale: 0.9 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "absolute z-10 grid h-11 w-11 place-items-center rounded-full border border-black/[0.05] bg-white/85 text-slate-500 backdrop-blur-xl transition-colors duration-200 hover:text-[#ED1846] disabled:pointer-events-none disabled:opacity-0",
        side === "left" ? "left-1.5" : "right-1.5"
      )}
      style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.10), 0 10px 26px -8px rgba(15,23,42,0.22), 0 3px 10px -3px rgba(237,24,70,0.20)" }}
    >
      <Icon size={17} weight="bold" />
    </motion.button>
  );
}
