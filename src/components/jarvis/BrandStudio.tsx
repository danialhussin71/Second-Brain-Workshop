"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleNotch,
  Fingerprint,
  Flask,
  FloppyDisk,
  IdentificationBadge,
  ImageSquare,
  PaintBrushBroad,
  Palette,
  Scan,
  ShieldCheck,
  Signature,
  TextAa,
  Trash,
  UploadSimple,
  UserCircle,
  Waveform,
} from "@phosphor-icons/react";
import type { BrandAsset, BrandColor, BrandKit } from "@/lib/brand-kit";

type Busy = "load" | "save" | "face" | "logo" | "reference" | "analyze" | "remove" | null;

const inputClass = "mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-fuchsia-300/45 focus:bg-black/30";
const assetUrl = (kind: BrandAsset["kind"], bust: number, id?: string) =>
  `/api/brand/asset?kind=${kind}${id ? `&id=${encodeURIComponent(id)}` : ""}&v=${bust}`;

export default function BrandStudio({ onSaved }: { onSaved?: (message: string) => void }) {
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState<Busy>("load");
  const [message, setMessage] = useState("");
  const [bust, setBust] = useState(0);
  const referenceInput = useRef<HTMLInputElement>(null);

  async function load() {
    setBusy("load");
    try {
      const response = await fetch("/api/brand", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load brand kit.");
      setConnected(Boolean(data.connected));
      setKit(data.kit);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load brand kit.");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => { void load(); }, []);

  const update = (patch: Partial<BrandKit>) => setKit((current) => current ? { ...current, ...patch } : current);
  const readiness = useMemo(() => {
    if (!kit) return { score: 0, done: 0, total: 8 };
    const checks = [kit.displayName, kit.tagline, kit.colors.length >= 5, kit.headlineFont, kit.bodyFont, kit.voice, kit.assets.face, kit.assets.references.length];
    const done = checks.filter(Boolean).length;
    return { done, total: checks.length, score: Math.round(done / checks.length * 100) };
  }, [kit]);

  const notify = (text: string) => {
    setMessage(text);
    onSaved?.(text);
    window.dispatchEvent(new Event("jarvis-brand-updated"));
  };

  async function save() {
    if (!kit) return;
    setBusy("save");
    setMessage("");
    try {
      const response = await fetch("/api/brand", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ kit }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Save failed.");
      setKit(data.kit);
      notify("Brand system saved. Every marketing agent will use it.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setBusy(null);
    }
  }

  async function upload(kind: BrandAsset["kind"], file: File) {
    setBusy(kind);
    setMessage("");
    try {
      const form = new FormData();
      form.append("kind", kind);
      form.append("file", file);
      const response = await fetch("/api/brand/asset", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      setKit(data.kit);
      setBust((value) => value + 1);
      notify(kind === "reference" ? "Style reference added." : `${kind === "face" ? "Founder face" : "Logo"} updated.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(null);
    }
  }

  async function uploadReferences(files: FileList | null) {
    for (const file of Array.from(files || []).slice(0, Math.max(0, 4 - (kit?.assets.references.length || 0)))) await upload("reference", file);
    if (referenceInput.current) referenceInput.current.value = "";
  }

  async function remove(kind: BrandAsset["kind"], id?: string) {
    setBusy("remove");
    try {
      const response = await fetch("/api/brand/asset", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not remove asset.");
      setKit(data.kit);
      setBust((value) => value + 1);
      notify("Brand asset removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove asset.");
    } finally {
      setBusy(null);
    }
  }

  async function analyzeReferences() {
    setBusy("analyze");
    setMessage("GPT-5.6 Sol is reverse-engineering the visual system…");
    try {
      const response = await fetch("/api/brand/extract", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analysis failed.");
      setKit(data.kit);
      notify(`Visual system learned from ${data.analyzed} reference${data.analyzed === 1 ? "" : "s"}. Review and save when ready.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Analysis failed.");
    } finally {
      setBusy(null);
    }
  }

  if (!kit || busy === "load") return <div className="grid min-h-[420px] place-items-center"><CircleNotch size={24} className="animate-spin text-fuchsia-300" /></div>;

  const accent = kit.colors[0]?.hex || "#5B677A";
  const ink = kit.colors[1]?.hex || "#0B0C10";

  return <div className="space-y-5 pb-20">
    <section className="relative overflow-hidden rounded-3xl border border-fuchsia-300/20 bg-[linear-gradient(135deg,rgba(217,70,239,.1),rgba(34,211,238,.03)_55%,rgba(255,255,255,.02))] p-5">
      <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-fuchsia-500/15 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl"><div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl border border-fuchsia-300/25 bg-fuchsia-400/10 text-fuchsia-200"><Fingerprint size={18} weight="duotone" /></div><p className="text-lg font-semibold tracking-tight">Build a brand Jarvis can actually use</p><p className="mt-1.5 text-xs leading-relaxed text-white/45">Identity, visuals, and voice become durable instructions. Uploaded references are passed into GPT Image 2, while every marketing agent receives the written brand system.</p></div>
        <div className="min-w-32 rounded-2xl border border-white/10 bg-black/20 p-3 text-right"><p className="text-[10px] uppercase tracking-[.18em] text-white/35">Brand readiness</p><p className="mt-1 text-2xl font-semibold text-white">{readiness.score}%</p><p className="text-[10px] text-white/35">{readiness.done} of {readiness.total} essentials</p></div>
      </div>
    </section>

    <section className="grid gap-4 lg:grid-cols-[1.12fr_.88fr]">
      <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
        <SectionTitle icon={<IdentificationBadge size={16} weight="duotone" />} title="Identity assets" detail="Use clean, high-resolution PNG, JPG, or WebP files." />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <PrimaryAssetCard label="Founder face" hint="Portrait, cover cutout, and recurring avatar" kind="face" asset={kit.assets.face} bust={bust} busy={busy === "face"} onPick={(file) => upload("face", file)} onRemove={() => remove("face")} />
          <PrimaryAssetCard label="Logo mark" hint="Brand signature and approved watermark" kind="logo" asset={kit.assets.logo} bust={bust} busy={busy === "logo"} onPick={(file) => upload("logo", file)} onRemove={() => remove("logo")} />
        </div>
      </div>
      <BrandPreview kit={kit} accent={accent} ink={ink} bust={bust} />
    </section>

    <section className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[.035] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><SectionTitle icon={<Flask size={16} weight="duotone" />} title="Visual reference lab" detail="Upload up to four great examples. Jarvis learns the recurring system, not just the mood." /><button onClick={() => void analyzeReferences()} disabled={busy !== null || !kit.assets.references.length} className="flex items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:opacity-35">{busy === "analyze" ? <CircleNotch size={14} className="animate-spin" /> : <Scan size={14} weight="duotone" />}Learn style from references</button></div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {kit.assets.references.map((asset) => <ReferenceTile key={asset.id} asset={asset} bust={bust} onRemove={() => void remove("reference", asset.id)} />)}
        {kit.assets.references.length < 4 && <button onClick={() => referenceInput.current?.click()} disabled={busy !== null} className="group flex aspect-[4/5] min-h-28 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black/20 text-white/35 transition hover:border-cyan-300/40 hover:text-cyan-100 disabled:opacity-40"><UploadSimple size={19} weight="bold" /><span className="text-[10px] font-medium">Add references</span></button>}
      </div>
      <input ref={referenceInput} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(event) => void uploadReferences(event.target.files)} />
    </section>

    <section className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
      <SectionTitle icon={<Signature size={16} weight="duotone" />} title="Brand identity" detail="The recurring signature shown across every deliverable." />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <InputField label="Founder / brand name" value={kit.displayName} onChange={(displayName) => update({ displayName })} placeholder="Jane Doe" />
        <InputField label="Handle" value={kit.handle} onChange={(handle) => update({ handle })} placeholder="janedoe" prefix="@" />
        <InputField label="Tagline" value={kit.tagline} onChange={(tagline) => update({ tagline })} placeholder="A memorable one-line promise" wide />
        <InputField label="Website" value={kit.website} onChange={(website) => update({ website })} placeholder="https://example.com" wide />
      </div>
    </section>

    <section className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
      <SectionTitle icon={<Palette size={16} weight="duotone" />} title="Colour system" detail="Exact values are injected into visual prompts. The first colour is the main accent." />
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {kit.colors.slice(0, 6).map((color, index) => <ColorControl key={color.id} color={color} onChange={(next) => update({ colors: kit.colors.map((item, itemIndex) => itemIndex === index ? next : item) })} />)}
      </div>
    </section>

    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><SectionTitle icon={<TextAa size={16} weight="duotone" />} title="Typography" detail="Describe usable font families or a clear typographic character." /><div className="mt-4 space-y-3"><InputField label="Headline system" value={kit.headlineFont} onChange={(headlineFont) => update({ headlineFont })} placeholder="Heavy condensed grotesque" /><InputField label="Body system" value={kit.bodyFont} onChange={(bodyFont) => update({ bodyFont })} placeholder="Rounded geometric sans-serif" /></div></div>
      <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><SectionTitle icon={<Waveform size={16} weight="duotone" />} title="Voice DNA" detail="How the brand should sound when Jarvis writes." /><TextField label="Tone and rhythm" value={kit.voice} onChange={(voice) => update({ voice })} placeholder="Direct, warm, short sentences…" rows={5} /></div>
    </section>

    <section className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
      <SectionTitle icon={<ShieldCheck size={16} weight="duotone" />} title="Language guardrails" detail="Give every agent the same verbal instincts." />
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><TextField label="Use more of" value={kit.vocabulary} onChange={(vocabulary) => update({ vocabulary })} placeholder="Favourite words, phrases, patterns, beliefs…" rows={5} /><TextField label="Never use" value={kit.avoid} onChange={(avoid) => update({ avoid })} placeholder="Banned phrases, clichés, punctuation, claims…" rows={5} /></div>
    </section>

    <section className="rounded-2xl border border-fuchsia-300/15 bg-fuchsia-400/[.025] p-4">
      <SectionTitle icon={<PaintBrushBroad size={16} weight="duotone" />} title="Locked visual style" detail="The production specification applied to every carousel slide and generated visual." />
      <textarea value={kit.styleSpec} onChange={(event) => update({ styleSpec: event.target.value })} rows={12} spellCheck={false} className={`${inputClass} min-h-52 resize-y font-mono text-[11px] leading-relaxed`} placeholder="Describe composition, palette, hierarchy, repeatable components, imagery, spacing, and consistency rules…" />
      <TextField label="Additional production notes" value={kit.notes} onChange={(notes) => update({ notes })} placeholder="Anything else the team must preserve…" rows={4} />
    </section>

    <div className="sticky bottom-0 z-10 -mx-5 flex items-center justify-between gap-3 border-t border-white/10 bg-[#080b12]/92 px-5 py-3 backdrop-blur-xl">
      <div><p className={`text-[11px] ${message ? "text-cyan-100/75" : "text-white/35"}`}>{message || (connected ? "Stored privately in Vercel Blob" : "Connect Vercel Blob to save changes")}</p><p className="mt-0.5 text-[9px] text-white/25">Face, logo, palette, voice, and references flow into production.</p></div>
      <button onClick={() => void save()} disabled={busy !== null || !connected} className="flex shrink-0 items-center gap-2 rounded-xl bg-fuchsia-300 px-4 py-2.5 text-xs font-semibold text-[#18051b] shadow-[0_0_28px_rgba(232,121,249,.18)] transition hover:bg-fuchsia-200 disabled:opacity-40">{busy === "save" ? <CircleNotch size={15} className="animate-spin" /> : <FloppyDisk size={15} weight="bold" />}Save brand system</button>
    </div>
  </div>;
}

function SectionTitle({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div><p className="flex items-center gap-2 text-sm font-semibold text-white/90"><span className="text-fuchsia-200">{icon}</span>{title}</p><p className="mt-1 text-[11px] leading-relaxed text-white/38">{detail}</p></div>;
}

function BrandPreview({ kit, accent, ink, bust }: { kit: BrandKit; accent: string; ink: string; bust: number }) {
  return <div className="relative min-h-60 overflow-hidden rounded-2xl border border-white/10 p-5" style={{ background: `radial-gradient(circle at 76% 14%, ${accent}55, transparent 38%), linear-gradient(145deg, ${ink}, #030409)` }}>
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
    <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3">{kit.assets.face ? <img src={assetUrl("face", bust)} alt="Founder" className="h-14 w-14 rounded-full border-2 object-cover" style={{ borderColor: accent }} /> : <div className="grid h-14 w-14 place-items-center rounded-full border border-white/15 bg-white/5"><UserCircle size={24} className="text-white/35" /></div>}<div><p className="text-base font-semibold text-white">{kit.displayName || "Your name"}</p><p className="text-[10px] text-white/50">{kit.handle ? `@${kit.handle}` : "@handle"}</p></div></div>{kit.assets.logo ? <img src={assetUrl("logo", bust)} alt="Logo" className="h-9 max-w-24 object-contain" /> : <div className="rounded-lg border border-white/10 px-2 py-1 text-[9px] uppercase tracking-[.18em] text-white/30">Logo</div>}</div>
    <div className="mt-11 max-w-[85%]"><p className="text-[9px] font-semibold uppercase tracking-[.22em]" style={{ color: accent }}>Brand preview</p><p className="mt-2 text-2xl font-black uppercase leading-[.95] tracking-tight text-white" style={{ fontFamily: "Impact, Haettenschweiler, sans-serif" }}>{kit.tagline || "Your defining idea lives here"}</p><p className="mt-3 text-[10px] leading-relaxed text-white/45">One identity. One visual language. Every deliverable unmistakably yours.</p></div>
    <div className="absolute bottom-4 left-5 flex gap-1.5">{kit.colors.slice(0, 5).map((color) => <span key={color.id} title={`${color.name} ${color.hex}`} className="h-3 w-3 rounded-full border border-white/20" style={{ background: color.hex }} />)}</div><span className="absolute bottom-4 right-5 text-[9px] text-white/25">01</span>
  </div>;
}

function PrimaryAssetCard({ label, hint, kind, asset, bust, busy, onPick, onRemove }: { label: string; hint: string; kind: "face" | "logo"; asset: BrandAsset | null; bust: number; busy: boolean; onPick: (file: File) => void; onRemove: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  return <div className="rounded-xl border border-white/8 bg-black/15 p-3"><div className="mb-2 flex items-center justify-between"><div><p className="text-xs font-medium text-white/75">{label}</p><p className="mt-0.5 text-[9px] text-white/30">{hint}</p></div>{asset && <button aria-label={`Remove ${label}`} onClick={onRemove} className="rounded-lg p-1.5 text-white/25 transition hover:bg-rose-400/10 hover:text-rose-300"><Trash size={13} /></button>}</div><button onClick={() => input.current?.click()} disabled={busy} className="group relative grid h-32 w-full place-items-center overflow-hidden rounded-xl border border-dashed border-white/12 bg-black/25 transition hover:border-fuchsia-300/40 disabled:opacity-50">{asset ? <img src={assetUrl(kind, bust)} alt={label} className={`h-full w-full ${kind === "face" ? "object-cover" : "object-contain p-4"}`} /> : <span className="flex flex-col items-center gap-2 text-white/30">{busy ? <CircleNotch size={20} className="animate-spin" /> : kind === "face" ? <UserCircle size={22} weight="duotone" /> : <ImageSquare size={22} weight="duotone" />}<span className="text-[10px]">Upload {label.toLowerCase()}</span></span>}<span className="absolute inset-0 hidden items-center justify-center bg-black/60 text-[10px] font-semibold text-white group-hover:flex">{asset ? "Replace" : "Choose image"}</span></button><input ref={input} className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => event.target.files?.[0] && onPick(event.target.files[0])} /></div>;
}

function ReferenceTile({ asset, bust, onRemove }: { asset: BrandAsset; bust: number; onRemove: () => void }) {
  return <div className="group relative aspect-[4/5] min-h-28 overflow-hidden rounded-xl border border-white/10 bg-black/25"><img src={assetUrl("reference", bust, asset.id)} alt={asset.name} className="h-full w-full object-cover" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-8"><p className="truncate text-[9px] text-white/70">{asset.name}</p></div><button aria-label={`Remove ${asset.name}`} onClick={onRemove} className="absolute right-1.5 top-1.5 rounded-lg border border-white/10 bg-black/60 p-1.5 text-white/55 opacity-0 backdrop-blur transition hover:text-rose-300 group-hover:opacity-100"><Trash size={12} /></button></div>;
}

function InputField({ label, value, onChange, placeholder, prefix, wide = false }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; prefix?: string; wide?: boolean }) {
  return <label className={wide ? "sm:col-span-2" : ""}><span className="text-[10px] font-medium uppercase tracking-[.14em] text-white/35">{label}</span><div className="relative">{prefix && <span className="absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-xs text-white/25">{prefix}</span>}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={`${inputClass} ${prefix ? "pl-7" : ""}`} /></div></label>;
}

function TextField({ label, value, onChange, placeholder, rows }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; rows: number }) {
  return <label className="mt-4 block"><span className="text-[10px] font-medium uppercase tracking-[.14em] text-white/35">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows} className={`${inputClass} resize-y text-xs leading-relaxed`} /></label>;
}

function ColorControl({ color, onChange }: { color: BrandColor; onChange: (value: BrandColor) => void }) {
  return <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-black/15 p-2"><label className="relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-white/15" style={{ background: color.hex }}><input aria-label={`${color.name} color picker`} type="color" value={color.hex} onChange={(event) => onChange({ ...color, hex: event.target.value.toUpperCase() })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" /></label><div className="min-w-0 flex-1"><input aria-label={`${color.name} name`} value={color.name} onChange={(event) => onChange({ ...color, name: event.target.value })} className="w-full bg-transparent text-[11px] font-medium text-white/70 outline-none" /><input aria-label={`${color.name} hex`} value={color.hex} onChange={(event) => onChange({ ...color, hex: event.target.value.toUpperCase() })} className="mt-0.5 w-full bg-transparent font-mono text-[10px] uppercase text-white/30 outline-none" /></div></div>;
}
