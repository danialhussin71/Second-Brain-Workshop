"use client";

import { create } from "zustand";

/**
 * The graph is shared with the original Second Brain renderer. Jarvis only uses
 * its live mode, but this small compatible store keeps the renderer's natural
 * hover, drag, and idle animation behaviour intact.
 */
type PresentationState = {
  mode: "live" | "stage";
  woken: boolean;
  answer: string;
  querying: boolean;
  dragging: boolean;
  setDragging: (dragging: boolean) => void;
  setExpanded: (_expanded: boolean) => void;
};

export const usePresentation = create<PresentationState>((set) => ({
  mode: "live",
  woken: false,
  answer: "",
  querying: false,
  dragging: false,
  setDragging: (dragging) => set({ dragging }),
  setExpanded: () => undefined,
}));
