"use client";

import { useState } from "react";
import { GearSix } from "@phosphor-icons/react";
import HudFrame from "@/components/jarvis/HudFrame";
import OrgPyramid from "@/components/jarvis/OrgPyramid";
import ResponsePanel from "@/components/jarvis/ResponsePanel";
import CommandBar from "@/components/jarvis/CommandBar";
import { useJarvisRun } from "@/components/jarvis/useJarvisRun";
import SettingsPanel from "@/components/jarvis/SettingsPanel";

export default function JarvisPage() {
  const { state, run } = useJarvisRun();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return <div className="h-screen w-screen overflow-hidden bg-[#02040a] text-white">
    <HudFrame actions={<button onClick={() => setSettingsOpen(true)} title="Second brain settings" className="group flex h-8 items-center gap-1.5 rounded-lg border border-violet-300/25 bg-violet-400/[.07] px-2.5 text-[11.5px] font-medium text-violet-100/90 backdrop-blur-xl transition hover:border-violet-300/60 hover:bg-violet-400/[.15] hover:text-white"><GearSix size={16} weight="duotone" className="transition group-hover:rotate-45" /><span className="hidden lg:inline">Settings</span></button>}>
      <div className="grid h-full grid-cols-1 grid-rows-[minmax(0,1fr)_auto] gap-y-3 px-5 pb-5 pt-14 lg:grid-cols-[minmax(0,1fr)_1px_clamp(360px,42%,560px)]">
        <main className="relative hidden min-w-0 flex-col pr-6 lg:col-start-1 lg:row-start-1 lg:flex">
          <div className="mb-2 flex items-center justify-between px-1.5"><span className="text-[11px] font-semibold uppercase tracking-[.22em] text-white/45">Organization</span><RunStatus running={state.running} done={state.done} /></div>
          <div className="relative min-h-0 flex-1"><OrgPyramid active={state.active} litPath={state.litPath} phases={state.phases} feed={state.feed} running={state.running} /></div>
        </main>
        <div className="hidden w-px bg-gradient-to-b from-transparent via-white/12 to-transparent lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:block" />
        <aside className="flex min-h-0 w-full flex-col lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:pl-6"><ResponsePanel state={state} /></aside>
        <div className="flex flex-col justify-center gap-2 px-2 lg:col-start-1 lg:row-start-2 lg:pr-6"><div className="w-full max-w-xl"><CommandBar onSubmit={run} running={state.running} /></div></div>
      </div>
    </HudFrame>
    <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
  </div>;
}

function RunStatus({ running, done }: { running: boolean; done: boolean }) {
  const label = running ? "Live run" : done ? "Complete" : "Standby";
  const color = running ? "#22d3ee" : done ? "#34d399" : "rgba(255,255,255,.35)";
  return <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[.03] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.18em] text-white/55"><span className="h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: running || done ? `0 0 8px ${color}` : "none" }} />{label}</span>;
}
