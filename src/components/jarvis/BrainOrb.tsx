"use client";

import { useCallback, useEffect, useState } from "react";
import BrainGraph from "@/components/BrainGraph";
import { BRAIN_UPDATED_EVENT } from "@/lib/brain-events";
import type { BrainGraph as Graph } from "@/lib/vault";

/** The right-hand idle state is a live window into the same uploaded vault. */
export default function BrainOrb() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const load = useCallback(async (signal: AbortSignal) => {
    try {
      const response = await fetch("/api/brain", { cache: "no-store", signal });
      if (response.ok) setGraph((await response.json())?.graph || null);
    } catch { /* aborted or offline — keep the graph already on screen */ }
  }, []);
  useEffect(() => {
    let controller = new AbortController();
    void load(controller.signal);
    const refresh = () => { controller.abort(); controller = new AbortController(); void load(controller.signal); };
    window.addEventListener(BRAIN_UPDATED_EVENT, refresh);
    return () => { controller.abort(); window.removeEventListener(BRAIN_UPDATED_EVENT, refresh); };
  }, [load]);
  return <BrainGraph data={graph} />;
}
