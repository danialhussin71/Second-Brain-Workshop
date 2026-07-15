"use client";

import { useEffect, useState } from "react";

/**
 * The Iron-Man HUD dressing: corner brackets, a vignette + grid, and a live
 * clock. Pure chrome — it frames the live dashboard and sells the "mission
 * control" feel without carrying state. Pages can mount their utility actions
 * (nav chips, sound, settings) into the top rail via `actions` so the stage
 * below stays clear.
 */

export default function HudFrame({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  const [clock, setClock] = useState<string>("");
  const [date, setDate] = useState<string>("");

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
      setDate(d.toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short" }).toUpperCase());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* deep field background */}
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% 35%, #060a14 0%, #02040a 60%, #010207 100%)" }} />
      {/* faint grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.25]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.05) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(120% 90% at 50% 40%, #000 30%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(120% 90% at 50% 40%, #000 30%, transparent 85%)",
        }}
      />

      {/* corner brackets */}
      {([
        "left-3 top-3 border-l border-t",
        "right-3 top-3 border-r border-t",
        "left-3 bottom-3 border-l border-b",
        "right-3 bottom-3 border-r border-b",
      ] as const).map((c) => (
        <div key={c} className={`pointer-events-none absolute h-6 w-6 border-cyan-300/40 ${c}`} />
      ))}

      {/* top rail — identity left, utilities + time right */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-6 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-lg border border-white/15 bg-white shadow-[0_0_20px_rgba(34,211,238,.12)]">
            <img src="/brand/second-brain-icon.png" alt="" className="h-7 w-7 object-contain" />
          </span>
          <span className="text-[15px] font-bold tracking-[0.3em] text-cyan-200">SECOND BRAIN</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-4 font-mono text-[11px] text-white/45 md:flex">
            <span className="tracking-widest text-white/30">{date}</span>
            <span className="tabular-nums tracking-widest text-cyan-200/80">{clock}</span>
          </div>
          {actions && (
            <>
              <span aria-hidden className="hidden h-4 w-px bg-white/10 md:block" />
              <div className="pointer-events-auto flex items-center gap-2">{actions}</div>
            </>
          )}
        </div>
      </div>

      {/* content */}
      <div className="relative z-10 h-full w-full">{children}</div>
    </div>
  );
}
