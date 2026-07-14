"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  FileText,
  FloppyDisk,
  ArrowsClockwise,
  CircleNotch,
  Check,
  Palette,
  Sparkle,
  UploadSimple,
  Image as ImageIcon,
  UserCircle,
  MagicWand,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import RichEditor from "./RichEditor";

type Doc = { docType: string; title: string; summary: string; authority: number; body: string };
type Tab = "vault" | "knowledge" | "branding";

export default function DocSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("vault");

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 36 }}
            className="fixed right-0 top-0 z-[61] flex h-full w-full max-w-3xl flex-col border-l border-white/10 bg-[#080b12]/95 shadow-2xl backdrop-blur-2xl"
          >
            {/* Header + tabs */}
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <div>
                <div className="text-sm font-semibold tracking-tight text-foreground">Knowledge & settings</div>
                <div className="text-xs text-foreground/40">Upload vault · curated docs · brand</div>
              </div>
              <button onClick={onClose} className="rounded-lg p-2 text-foreground/50 transition hover:bg-white/5 hover:text-foreground">
                <X size={18} weight="bold" />
              </button>
            </div>
            <div className="flex shrink-0 items-center gap-1 border-b border-white/8 px-3 py-2">
              {(
                [
                  ["vault", "Vault upload", UploadSimple],
                  ["knowledge", "Knowledge", FileText],
                  ["branding", "Branding", Palette],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition",
                    tab === key ? "bg-white/10 text-foreground" : "text-foreground/45 hover:text-foreground/80"
                  )}
                >
                  <Icon size={14} weight="duotone" /> {label}
                </button>
              ))}
            </div>

            {tab === "vault" ? <VaultPanel open={open} /> : tab === "knowledge" ? <KnowledgePanel open={open} /> : <BrandingPanel open={open} />}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ─────────────────── Vault upload (Supabase vectors) ─────────────────── */

function VaultPanel({ open }: { open: boolean }) {
  const [stats, setStats] = useState<{ documents: number; chunks: number; folders: number; configured?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/brain");
      const data = await res.json();
      setStats(data.stats ?? { documents: 0, chunks: 0, folders: 0 });
      setHint(data.hint ?? null);
    } catch {
      setStats({ documents: 0, chunks: 0, folders: 0 });
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));
      const res = await fetch("/api/brain/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Upload failed");
      toast.success(`Indexed ${data.documents ?? data.uploaded} notes · ${data.chunks} chunks`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function seed() {
    setBusy(true);
    try {
      const res = await fetch("/api/brain/upload?seed=1", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Seed failed");
      toast.success(`Seeded ${data.seeded} docs from content/knowledge`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
      <p className="mb-4 max-w-xl text-[13px] leading-relaxed text-foreground/50">
        Optional. Upload markdown or a vault zip to index in Supabase. Chat already works from the bundled <code className="text-foreground/70">content/knowledge</code> docs without Supabase.
      </p>

      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          ["Documents", stats?.documents ?? "—"],
          ["Chunks", stats?.chunks ?? "—"],
          ["Folders", stats?.folders ?? "—"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
            <div className="text-[10px] uppercase tracking-wider text-foreground/35">{label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-foreground/90">{value}</div>
          </div>
        ))}
      </div>

      {hint && (
        <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[12px] text-amber-100/80">
          {hint}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-xl border border-cyan-400/35 bg-cyan-400/10 px-4 py-2.5 text-[13px] font-medium text-cyan-100 transition hover:bg-cyan-400/20",
            busy && "pointer-events-none opacity-50"
          )}
        >
          {busy ? <CircleNotch size={16} className="animate-spin" /> : <UploadSimple size={16} weight="bold" />}
          Upload .md or .zip
          <input
            ref={inputRef}
            type="file"
            accept=".md,.markdown,.txt,.zip"
            multiple
            className="hidden"
            disabled={busy}
            onChange={(e) => void upload(e.target.files)}
          />
        </label>
        <button
          onClick={() => void seed()}
          disabled={busy}
          className="flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2.5 text-[13px] font-medium text-foreground/80 transition hover:bg-white/[0.08] disabled:opacity-50"
        >
          <Sparkle size={16} weight="duotone" />
          Seed from content/knowledge
        </button>
        <button
          onClick={() => void refresh()}
          disabled={busy}
          className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-[12px] text-foreground/50 transition hover:text-foreground/80 disabled:opacity-50"
        >
          <ArrowsClockwise size={14} />
          Refresh
        </button>
      </div>
    </div>
  );
}

/* ─────────────────── Knowledge (docs, rich editor) ─────────────────── */

function KnowledgePanel({ open }: { open: boolean }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [reembedding, setReembedding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/studio/docs");
      const data = await res.json();
      const list: Doc[] = data.docs ?? [];
      setDocs(list);
      setActiveType((cur) => cur ?? list[0]?.docType ?? null);
    } catch {
      toast.error("Couldn't load your documents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const active = docs.find((d) => d.docType === activeType) ?? null;
  useEffect(() => {
    if (active) setDraft(active.body);
  }, [activeType]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = active ? draft !== active.body : false;

  async function save() {
    if (!active) return;
    setSaving(true);
    try {
      const res = await fetch("/api/studio/docs", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ docType: active.docType, body: draft }),
      });
      if (!res.ok) throw new Error();
      setDocs((prev) => prev.map((d) => (d.docType === active.docType ? { ...d, body: draft } : d)));
      toast.success(`${active.title} saved`);
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function reembed() {
    if (!active) return;
    if (dirty) await save();
    setReembedding(true);
    try {
      const res = await fetch("/api/studio/docs/reembed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ docType: active.docType }),
      });
      const data = await res.json();
      if (data.warning) toast.message(`${active.title} re-embedded (local only)`);
      else toast.success(`${active.title} re-embedded`);
    } catch {
      toast.error("Re-embed failed");
    } finally {
      setReembedding(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div data-lenis-prevent className="w-56 shrink-0 overflow-y-auto border-r border-white/8 p-2">
        {loading && <div className="p-3 text-xs text-foreground/35">Loading…</div>}
        {docs.map((d) => (
          <button
            key={d.docType}
            onClick={() => setActiveType(d.docType)}
            className={cn(
              "flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left transition",
              activeType === d.docType ? "bg-white/[0.07]" : "hover:bg-white/[0.03]"
            )}
          >
            <FileText size={14} weight="duotone" className="mt-0.5 shrink-0 text-accent-300" />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-foreground/85">{d.title}</span>
              <span className="block truncate text-[10px] uppercase tracking-wide text-foreground/30">{d.docType}</span>
            </span>
          </button>
        ))}
        {!loading && docs.length === 0 && <div className="p-3 text-xs text-foreground/35">No documents found.</div>}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {active ? (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">{active.title}</div>
                <div className="truncate text-xs text-foreground/40">{active.summary}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={save}
                  disabled={saving || !dirty}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                    dirty ? "border-white/15 bg-white/[0.06] text-foreground hover:bg-white/10" : "border-white/8 text-foreground/30"
                  )}
                >
                  {saving ? <CircleNotch size={13} className="animate-spin" /> : <FloppyDisk size={13} weight="bold" />}
                  Save
                </button>
                <button
                  onClick={reembed}
                  disabled={reembedding}
                  className="flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-50"
                >
                  {reembedding ? <CircleNotch size={13} className="animate-spin" /> : <ArrowsClockwise size={13} weight="bold" />}
                  Re-embed
                </button>
              </div>
            </div>
            {/* keyed by doc so the editor remounts with each doc's markdown */}
            <RichEditor key={activeType} value={active.body} onChange={setDraft} placeholder="This document is empty." />
            <div className="flex items-center gap-1.5 border-t border-white/8 px-5 py-2 text-[11px] text-foreground/35">
              {dirty ? <>Unsaved changes</> : (<><Check size={12} weight="bold" className="text-emerald-300" /> Saved</>)}
              <span className="ml-auto">Rich text · saved as markdown · {draft.length.toLocaleString()} chars</span>
            </div>
          </>
        ) : (
          <div className="grid flex-1 place-items-center text-sm text-foreground/35">{loading ? "Loading…" : "No documents found."}</div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────── Branding (brand kit + assets + extract) ─────────────────── */

type Kit = {
  displayName: string | null;
  handle: string | null;
  tagline: string | null;
  accentHex: string;
  styleSpec: string;
  fonts: string | null;
};

function BrandingPanel({ open }: { open: boolean }) {
  const [kit, setKit] = useState<Kit | null>(null);
  const [saving, setSaving] = useState(false);
  const [faceBust, setFaceBust] = useState(0);
  const [logoBust, setLogoBust] = useState(0);
  const [hasFace, setHasFace] = useState(true);
  const [hasLogo, setHasLogo] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const refInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/studio/brand");
      const data = await res.json();
      const k = data.kit;
      setKit({
        displayName: k?.displayName ?? "",
        handle: k?.handle ?? "",
        tagline: k?.tagline ?? "",
        accentHex: k?.accentHex ?? "#ED1846",
        styleSpec: k?.styleSpec ?? "",
        fonts: k?.fonts ?? "",
      });
    } catch {
      toast.error("Couldn't load your brand kit");
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const set = (patch: Partial<Kit>) => setKit((k) => (k ? { ...k, ...patch } : k));

  async function save() {
    if (!kit) return;
    setSaving(true);
    try {
      const res = await fetch("/api/studio/brand", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fields: {
            display_name: kit.displayName,
            handle: kit.handle,
            tagline: kit.tagline,
            accent_hex: kit.accentHex,
            style_spec: kit.styleSpec,
            fonts: kit.fonts,
          },
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Brand kit saved");
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAsset(kind: "face" | "logo", file: File) {
    const fd = new FormData();
    fd.append("kind", kind);
    fd.append("file", file);
    const res = await fetch("/api/studio/brand/asset", { method: "POST", body: fd });
    if (!res.ok) {
      toast.error(`${kind} upload failed`);
      return;
    }
    if (kind === "face") { setHasFace(true); setFaceBust((n) => n + 1); }
    else { setHasLogo(true); setLogoBust((n) => n + 1); }
    toast.success(`${kind === "face" ? "Face shot" : "Logo"} updated`);
  }

  async function extract(files: FileList) {
    if (!files.length) return;
    setExtracting(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));
      const res = await fetch("/api/studio/brand/extract", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.styleSpec) throw new Error(data.error || "extraction failed");
      set({ styleSpec: data.styleSpec });
      toast.success(`Style extracted from ${data.analyzed} reference${data.analyzed > 1 ? "s" : ""} — review & save`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setExtracting(false);
      if (refInput.current) refInput.current.value = "";
    }
  }

  if (!kit) return <div className="grid flex-1 place-items-center text-sm text-foreground/35">Loading…</div>;

  return (
    <div data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
      <p className="mb-4 text-[12px] leading-relaxed text-foreground/45">
        Your visual identity. This drives how carousels and visuals are generated — the style spec is the locked look, and your
        face shot lets the AI place your likeness on cover and closing slides.
      </p>

      {/* assets */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <AssetCard
          label="Face shot"
          hint="Used on cover & closing slides"
          icon={<UserCircle size={16} weight="duotone" />}
          src={hasFace ? `/api/studio/brand/asset?kind=face&t=${faceBust}` : null}
          onMissing={() => setHasFace(false)}
          onPick={(f) => uploadAsset("face", f)}
        />
        <AssetCard
          label="Logo (optional)"
          hint="Watermark / branding"
          icon={<ImageIcon size={16} weight="duotone" />}
          src={hasLogo ? `/api/studio/brand/asset?kind=logo&t=${logoBust}` : null}
          onMissing={() => setHasLogo(false)}
          onPick={(f) => uploadAsset("logo", f)}
        />
      </div>

      {/* identity fields */}
      <div className="space-y-3">
        <Field label="Display name">
          <input value={kit.displayName ?? ""} onChange={(e) => set({ displayName: e.target.value })} className={inputCls} placeholder="Daniel Paul" />
        </Field>
        <Field label="Header subtitle / tagline">
          <input value={kit.tagline ?? ""} onChange={(e) => set({ tagline: e.target.value })} className={inputCls} placeholder="Building powerful personal brands…" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Handle">
            <input value={kit.handle ?? ""} onChange={(e) => set({ handle: e.target.value })} className={inputCls} placeholder="danielpaul" />
          </Field>
          <Field label="Accent color">
            <div className="flex items-center gap-2">
              <input type="color" value={kit.accentHex} onChange={(e) => set({ accentHex: e.target.value })} className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-transparent" />
              <input value={kit.accentHex} onChange={(e) => set({ accentHex: e.target.value })} className={inputCls} placeholder="#ED1846" />
            </div>
          </Field>
        </div>
        <Field label="Fonts">
          <input value={kit.fonts ?? ""} onChange={(e) => set({ fonts: e.target.value })} className={inputCls} placeholder="Headlines: condensed grotesque…" />
        </Field>
      </div>

      {/* reference extraction */}
      <div className="mt-5 rounded-xl border border-accent-400/20 bg-accent-400/[0.04] p-3.5">
        <div className="flex items-center gap-2 text-[12.5px] font-semibold text-accent-100">
          <MagicWand size={15} weight="duotone" /> Learn the style from references
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-foreground/45">
          Upload reference carousels (PDF or PNG) and the AI reverse-engineers your locked visual style into the spec below. Review, then save.
        </p>
        <input ref={refInput} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" multiple className="hidden" onChange={(e) => e.target.files && extract(e.target.files)} />
        <button
          onClick={() => refInput.current?.click()}
          disabled={extracting}
          className="mt-2.5 flex items-center gap-2 rounded-lg border border-accent-400/40 bg-accent-400/15 px-3 py-1.5 text-[12px] font-medium text-accent-50 transition hover:bg-accent-400/25 disabled:opacity-50"
        >
          {extracting ? <CircleNotch size={14} className="animate-spin" /> : <UploadSimple size={14} weight="bold" />}
          {extracting ? "Analyzing references…" : "Upload references & extract"}
        </button>
      </div>

      {/* style spec */}
      <Field label="Locked visual style spec" className="mt-5">
        <textarea
          value={kit.styleSpec}
          onChange={(e) => set({ styleSpec: e.target.value })}
          spellCheck={false}
          rows={12}
          className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-3 font-mono text-[12px] leading-relaxed text-foreground/85 outline-none focus:border-accent-400/40"
          placeholder="The locked look that drives every generated visual…"
        />
      </Field>

      <div className="sticky bottom-0 -mx-5 mt-4 flex items-center justify-between border-t border-white/8 bg-[#080b12]/95 px-5 py-3 backdrop-blur">
        <span className="flex items-center gap-1.5 text-[11px] text-foreground/40">
          <Sparkle size={12} weight="fill" className="text-accent-300" /> Applies to all generated carousels & visuals
        </span>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg border border-accent-400/40 bg-accent-400/15 px-4 py-2 text-[12.5px] font-semibold text-accent-50 transition hover:bg-accent-400/25 disabled:opacity-50"
        >
          {saving ? <CircleNotch size={14} className="animate-spin" /> : <FloppyDisk size={14} weight="bold" />}
          Save brand kit
        </button>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[13px] text-foreground/90 outline-none transition focus:border-accent-400/40 placeholder:text-foreground/25";

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-foreground/40">{label}</span>
      {children}
    </label>
  );
}

function AssetCard({
  label,
  hint,
  icon,
  src,
  onMissing,
  onPick,
}: {
  label: string;
  hint: string;
  icon: React.ReactNode;
  src: string | null;
  onMissing: () => void;
  onPick: (f: File) => void;
}) {
  const inp = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-foreground/45">
        {icon} {label}
      </div>
      <button
        onClick={() => inp.current?.click()}
        className="group relative flex h-24 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-white/12 bg-black/30 transition hover:border-accent-300/40"
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={label} className="h-full w-full object-contain" onError={onMissing} />
        ) : (
          <span className="flex flex-col items-center gap-1 text-foreground/35">
            <UploadSimple size={18} weight="bold" />
            <span className="text-[10.5px]">Upload</span>
          </span>
        )}
        <span className="absolute inset-0 hidden items-center justify-center bg-black/55 text-[11px] font-medium text-white group-hover:flex">
          Replace
        </span>
      </button>
      <div className="mt-1.5 text-[10px] text-foreground/30">{hint}</div>
      <input ref={inp} type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} />
    </div>
  );
}
