"use client";

import { useEffect, useState } from "react";
import BrainGraph from "@/components/BrainGraph";
import type { BrainGraph as Graph } from "@/lib/vault";

/** The right-hand idle state is a live window into the same uploaded vault. */
export default function BrainOrb() {
  const [graph, setGraph] = useState<Graph | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/brain").then((response) => response.ok ? response.json() : null).then((data) => {
      if (!cancelled) setGraph(data?.graph || null);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  return <BrainGraph data={graph} />;
}
