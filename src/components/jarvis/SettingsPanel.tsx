"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Brain, FileText, GearSix, ImageSquare, Palette, UploadSimple, X, Sparkle } from "@phosphor-icons/react";
import BrainGraph from "@/components/BrainGraph";
import BrandStudio from "./BrandStudio";
import type { BrainGraph as Graph } from "@/lib/vault";
import { CAROUSEL_QUALITIES, CAROUSEL_QUALITY_KEY, normalizeCarouselQuality, type CarouselImageQuality } from "@/lib/carousel-settings";

type Status = { connected: boolean; documents: number; notes: Array<{ path: string; title: string; folder: string }>; graph: Graph };
type Tab = "brain" | "brand" | "carousel" | "documents";

export default function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("brain");
  const [status, setStatus] = useState<Status | null>(null);
  const [notice, setNotice] = useState("");
  const vaultInput = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => { const response = await fetch("/api/brain"); if (response.ok) setStatus(await response.json()); }, []);
  useEffect(() => { if (open) void load(); }, [open, load]);
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setNotice("Uploading vault…");
    const form = new FormData(); Array.from(files).forEach((file) => form.append("files", file));
    const response = await fetch("/api/brain/upload", { method: "POST", body: form }); const data = await response.json();
    setNotice(response.ok ? `${data.documents} notes imported. Paths and wiki links preserved.` : data.error || "Upload failed.");
    if (response.ok) await load();
  }
  return <AnimatePresence>{open && <>
    <motion.button aria-label="Close settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-[60] cursor-default bg-black/55 backdrop-blur-sm" />
    <motion.section initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 320, damping: 36 }} className="fixed right-0 top-0 z-[61] flex h-full w-full max-w-3xl flex-col border-l border-white/10 bg-[#080b12]/95 shadow-2xl backdrop-blur-2xl">
      <header className="flex items-center justify-between border-b border-white/8 px-5 py-4"><div><p className="flex items-center gap-2 text-sm font-semibold"><GearSix size={17} weight="duotone" />Knowledge & settings</p><p className="mt-1 text-xs text-white/40">One place for your brain, brand voice, and source documents.</p></div><button onClick={onClose} className="rounded-lg p-2 text-white/50 hover:bg-white/5 hover:text-white"><X size={18} weight="bold" /></button></header>
      <nav className="flex gap-1 border-b border-white/8 px-3 py-2">{([ ["brain", "Second brain", Brain], ["brand", "Brand kit", Palette], ["carousel", "Carousel", ImageSquare], ["documents", "Documents", FileText] ] as const).map(([key, label, Icon]) => <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium ${tab === key ? "bg-white/10 text-white" : "text-white/45 hover:text-white/80"}`}><Icon size={14} weight="duotone" />{label}</button>)}</nav>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">{tab === "brain" && <BrainTab status={status} notice={notice} input={vaultInput} upload={upload} />}{tab === "brand" && <BrandStudio onSaved={setNotice} />}{tab === "carousel" && <CarouselTab />}{tab === "documents" && <DocumentTab onSaved={async (message) => { setNotice(message); await load(); }} />}</div>
    </motion.section>
  </>}</AnimatePresence>;
}

function BrainTab({ status, notice, input, upload }: { status: Status | null; notice: string; input: React.RefObject<HTMLInputElement | null>; upload: (files: FileList | null) => Promise<void> }) {
  return <div className="space-y-5"><section className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold">Obsidian vault</p><p className="mt-1 text-xs leading-relaxed text-white/45">Upload a vault zip or a folder. Folder paths and <code>[[wiki links]]</code> are retained, so the live graph recreates your knowledge connections.</p></div><span className={`rounded-full px-2 py-1 text-[10px] ${status?.connected ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-200"}`}>{status?.connected ? "Blob connected" : "Blob needed"}</span></div><div className="mt-4 flex flex-wrap gap-2"><label className="flex cursor-pointer items-center gap-2 rounded-xl bg-cyan-400 px-3.5 py-2 text-xs font-semibold text-[#04121a]"><UploadSimple size={15} weight="bold" />Upload vault<input ref={input} className="hidden" type="file" accept=".zip,.md,.markdown,.txt" multiple onChange={(event) => void upload(event.target.files)} /></label><a href="/jarvis-demo-obsidian-brain.zip" download className="rounded-xl border border-white/12 px-3.5 py-2 text-xs font-medium text-white/70 hover:bg-white/5">Download sample vault</a></div>{notice && <p className="mt-3 text-xs text-cyan-100/70">{notice}</p>}</section><Constellation graph={status?.graph || null} /><section><div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[.16em] text-white/40">Imported notes</p><span className="text-xs text-white/35">{status?.documents ?? 0}</span></div><div className="space-y-1">{status?.notes?.length ? status.notes.map((note) => <div key={note.path} className="flex items-center justify-between rounded-lg border border-white/[.06] bg-white/[.02] px-3 py-2"><span className="text-xs text-white/80">{note.title}</span><span className="ml-3 truncate text-[10px] text-white/35">{note.path}</span></div>) : <p className="rounded-xl border border-dashed border-white/10 p-4 text-xs text-white/35">No uploaded notes yet. Jarvis still works without a vault.</p>}</div></section></div>;
}

function Constellation({ graph }: { graph: Graph | null }) {
  return <section className="overflow-hidden rounded-2xl border border-violet-300/20 bg-[#03050c] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]"><div className="mb-2 flex justify-between"><div><p className="text-xs font-semibold">Knowledge constellation</p><p className="mt-0.5 text-[10px] text-white/35">Drag nodes, zoom, or double-click to frame your brain.</p></div><p className="text-[10px] text-white/35">{graph?.links.length || 0} wiki links</p></div><div className="relative h-[340px] overflow-hidden rounded-xl border border-white/[.06]"><BrainGraph data={graph} /></div></section>;
}

function CarouselTab() {
  const [quality, setQuality] = useState<CarouselImageQuality>("high");
  useEffect(() => setQuality(normalizeCarouselQuality(window.localStorage.getItem(CAROUSEL_QUALITY_KEY))), []);
  const select = (value: CarouselImageQuality) => {
    setQuality(value);
    window.localStorage.setItem(CAROUSEL_QUALITY_KEY, value);
    window.dispatchEvent(new Event("jarvis-carousel-quality"));
  };
  const descriptions: Record<CarouselImageQuality, string> = {
    low: "Fastest and most economical for drafts.",
    medium: "Balanced quality and generation time.",
    high: "Maximum detail and typography quality.",
  };
  return <div className="max-w-2xl space-y-5"><Intro title="Carousel production system" text="Jarvis selects the exact carousel or cheatsheet playbook, writes structured slides, then renders each slide with GPT Image 2." /><section className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><p className="text-sm font-semibold">GPT Image 2 quality</p><p className="mt-1 text-xs leading-relaxed text-white/45">Saved in this browser and applied to every newly rendered carousel slide.</p><div className="mt-4 grid gap-2 sm:grid-cols-3">{CAROUSEL_QUALITIES.map((value) => <button key={value} onClick={() => select(value)} className={`rounded-xl border p-3 text-left transition ${quality === value ? "border-cyan-300/50 bg-cyan-400/[.1] shadow-[0_0_24px_rgba(34,211,238,.08)]" : "border-white/10 bg-black/15 hover:border-white/20"}`}><span className={`text-xs font-semibold capitalize ${quality === value ? "text-cyan-200" : "text-white/75"}`}>{value}</span><span className="mt-1 block text-[10px] leading-relaxed text-white/40">{descriptions[value]}</span></button>)}</div></section><section className="rounded-2xl border border-violet-300/15 bg-violet-400/[.04] p-4"><div className="flex items-center justify-between"><p className="text-sm font-semibold">Playbook library</p><span className="rounded-full bg-violet-400/10 px-2 py-1 text-[10px] text-violet-200">17 guides bundled</span></div><p className="mt-2 text-xs leading-relaxed text-white/45">Includes the current carousel master prompt, intent carousel, listicle cheatsheets, comparison tables, do’s-and-don’ts, three text-post styles, newsletter, strategy, profile, and content-description systems. Production does not depend on Supabase.</p></section></div>;
}
function DocumentTab({ onSaved }: { onSaved: (message: string) => Promise<void> }) { const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [saving, setSaving] = useState(false); const save = async () => { setSaving(true); const response = await fetch("/api/brain/note", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, body, folder: "Documents" }) }); const data = await response.json(); await onSaved(response.ok ? `${title} saved to your second brain.` : data.error || "Save failed."); setSaving(false); }; return <div className="max-w-xl space-y-4"><Intro title="Add a source document" text="Paste a brief, offer, ICP, research note, or any context you want Jarvis to remember." /><Field label="Document title" value={title} setValue={setTitle} placeholder="e.g. ICP profile" /><Field label="Content" value={body} setValue={setBody} placeholder="Write or paste the knowledge Jarvis should use…" area /><button onClick={() => void save()} disabled={saving || !title.trim() || !body.trim()} className="rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-semibold text-[#04121a] disabled:opacity-50">{saving ? "Saving…" : "Save document"}</button></div>; }
function Intro({ title, text }: { title: string; text: string }) { return <div className="rounded-2xl border border-violet-300/15 bg-violet-400/[.05] p-4"><Sparkle size={17} className="mb-2 text-violet-300" weight="duotone" /><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-relaxed text-white/45">{text}</p></div>; }
function Field({ label, value, setValue, placeholder, area = false }: { label: string; value: string; setValue: (value: string) => void; placeholder: string; area?: boolean }) { const cls = "mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-300/40"; return <label className="block text-xs font-medium text-white/70">{label}{area ? <textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className={`${cls} min-h-32 resize-y`} /> : <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className={cls} />}</label>; }
