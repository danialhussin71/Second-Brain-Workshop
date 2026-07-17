/**
 * The brain graph is fetched once per mount, so a note saved in Settings would
 * not reach an already-rendered orb until a page reload. Mutations announce
 * themselves here and every live view refetches.
 */
export const BRAIN_UPDATED_EVENT = "jarvis-brain-updated";

export function notifyBrainUpdated(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(BRAIN_UPDATED_EVENT));
}
