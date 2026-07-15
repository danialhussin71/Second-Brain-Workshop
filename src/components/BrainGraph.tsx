"use client";

/**
 * Custom canvas brain graph — "Synaptic Bloom": bioluminescent neural tissue.
 *
 * Built on d3-force + d3-zoom + raw 2D canvas so we control every pixel/frame.
 *
 * Look & behaviour:
 *  - Cached ink-gradient background w/ drifting aurora blobs + static grain (blitted once/frame).
 *  - Always-on additive self-glow via cached per-hue sprites — the whole graph is luminous;
 *    hubs glow more (degree-driven halo floor). NO per-node radial gradients in the hot loop.
 *  - Vivid on-brand palette (violet/cyan/teal/amber/rose) from src/lib/brain-visual.ts.
 *  - Hover → connected nodes brighten, others dim; inertial drag; right-click unpin; wheel zoom;
 *    double-click zoom-to-fit. Zoom-banded LOD + viewport culling keep 60fps at ~2500 nodes.
 *  - Cited notes IGNITE one-by-one (staggered): flash → wobbled ink shockwave → colour flare →
 *    action-potential beads travelling the links → sustained lit glow → fade.
 *  - Idle "spontaneous synapses" so it always feels like it's quietly thinking.
 *  - prefers-reduced-motion collapses motion to a calm cross-fade; keyboard-navigable.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceRadial,
  forceX,
  forceY,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import { zoom as d3zoom, zoomIdentity, type ZoomTransform } from "d3-zoom";
import { select } from "d3-selection";
import type { BrainGraph as GraphData } from "@/lib/vault";
import { usePresentation } from "@/lib/presentation-store";
import { computeSphereShape } from "@/lib/sphere-shape";
import {
  paletteHex,
  personaHex,
  litCoreHex,
  litHaloHex,
  stageColor,
  hashSeed,
  STAGE_BG,
  STAGE_LIT,
  STAGE_LINK,
  rgba,
  mixHex,
  easeOutExpo,
  easeInOutCubic,
  clamp01,
  lerp,
  nodeRadius2D,
  haloFloor,
  getGlowSprite,
  getCoreSprite,
  getSpikeSprite,
  getBeadSprite,
  makeNoiseTile,
  clearSpriteCache,
  staggerFor,
  STAGGER_MS,
  IGNITE_TOTAL_MS,
  PHASE,
  LERP,
  PULSE_BUDGET,
  DUST_DEV,
  DUST_PROD,
  BREATHE_RAD_PER_S,
  LOD,
  PROD_NODE_THRESHOLD,
  MAX_LABELS,
} from "@/lib/brain-visual";

/* ---------- Local link tints ----------------------------------------------- */
const LINK_IDLE = "#a78bfa";
const LINK_ACTIVE = "#c4b5fd";
const LINK_DIM = "#7c3aed";

/* ---------- Stage neural-firing cascade ("the query fires through the brain") -----
   When a query runs on stage, each recalled note is a SEED: it sends action potentials
   racing along its real wikilinks; every node a pulse reaches lights up and fires its own
   pulses onward, hop after hop (a spreading chain reaction), leaving a persistent glowing
   trail of every edge walked. These knobs tune how far/wide it spreads — bump for a bigger
   bloom, drop for a tighter one. */
const FIRE_FANOUT = 2;       // pulses each firing node sends onward (branching width)
const FIRE_MAX_HOP = 2;      // hops a cascade travels out from its seed
const FIRE_NODE_CAP = 50;    // HARD ceiling on cascade nodes lit per query (half of before)
const FIRE_EDGE_CAP = 50;     // HARD ceiling on connection paths drawn per query (half of before)
const STAGE_DY = 70;        // px the WOKEN network is framed below centre. CAMERA-ONLY — the dormant globe + world layout stay centred, so moving the brain graph never drags the globe with it.
const edgeKey = (a: string, b: string) => (a < b ? `${a}${b}` : `${b}${a}`);

/* ---------- Types ----------------------------------------------------------- */

type GraphNode = SimulationNodeDatum & {
  id: string;
  name: string;
  folder: string;
  val: number;
  group: number;
  degree: number;
  _baseHex?: string; // base colour — derived from id/group once, then cached (never per-frame)
  _phase?: number;   // stable per-node phase for desynced breathe/drift — hashed once
};
type GraphLink = SimulationLinkDatum<GraphNode> & {
  source: string | GraphNode;
  target: string | GraphNode;
  _ph?: number; // stable per-link phase → desynced idle twinkle
};
type NodeAnim = {
  alpha: number; targetAlpha: number;
  scale: number; targetScale: number;
  label: number; targetLabel: number;
};
type Bead = {
  active: boolean;
  sx: number; sy: number; tx: number; ty: number;
  tid: string; t0: number; depth: number;
};
type Dust = { x: number; y: number; phx: number; phy: number; r: number; hue: string };

type Props = {
  data: GraphData | null;
  /** CITED notes — final emphasis (the answer's [[wikilinks]]). */
  highlights?: string[];
  /** RETRIEVED notes — light up live as tools resolve (the "querying" scan). */
  researchIds?: string[];
  /** The persistent "read circuit": these notes stay softly lit + their inter-connections traced,
   *  and everything else dims, until this set changes (the next prompt). The neuron-fired pathway. */
  pathwayIds?: string[];
  /** True while a query is in flight before any results land — plays the "thinking" sweep. */
  thinking?: boolean;
  personaAgent?: string;
  onNodeClick?: (id: string) => void;
  /** Stage flow: start as a dormant brain silhouette, "wake up" → grow into the live network. */
  stage?: boolean;
};

/* Nearest-neighbour MST (Prim's) over node SCREEN positions — connects every node in `ids` into one
   tree with the shortest possible links. Used to "connect all the read notes with glowing lines". */
function pathwayTree(ids: string[], idMap: Map<string, GraphNode>): [string, string][] {
  const pts = ids
    .map((id) => idMap.get(id))
    .filter((n): n is GraphNode => !!n && n.x != null && n.y != null);
  if (pts.length < 2) return [];
  const inTree = new Set<string>([pts[0].id]);
  const edges: [string, string][] = [];
  while (inTree.size < pts.length) {
    let best: [string, string] | null = null;
    let bestD = Infinity;
    for (const a of pts) {
      if (!inTree.has(a.id)) continue;
      for (const b of pts) {
        if (inTree.has(b.id)) continue;
        const dx = a.x! - b.x!, dy = a.y! - b.y!;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = [a.id, b.id]; }
      }
    }
    if (!best) break;
    edges.push(best);
    inTree.add(best[1]);
  }
  return edges;
}

/* ---------- Component ------------------------------------------------------- */

export default function BrainGraph({
  data,
  highlights = [],
  researchIds = [],
  pathwayIds = [],
  thinking = false,
  personaAgent = "danny",
  onNodeClick,
  stage = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  const setDragging = usePresentation((s) => s.setDragging);
  // Stage: track "wake up" without re-running the heavy sim effect (read via ref in the loop).
  const woken = usePresentation((s) => s.woken);
  const wokenRef = useRef(woken);
  wokenRef.current = woken;
  // Stage: answer is up and we're waiting for the next question → recede the non-hit nodes.
  const answered = usePresentation((s) => s.mode === "stage" && !!s.answer && !s.querying);
  const answeredRef = useRef(answered);
  answeredRef.current = answered;

  // Live refs read inside the rAF loop (so the heavy sim effect never re-runs on hover/highlight)
  const reduced = useRef(false);
  const hoveredRef = useRef<string | null>(null);
  const highlightsRef = useRef<string[]>(highlights);
  const personaRef = useRef<string>(personaAgent);
  const thinkingRef = useRef(false);
  highlightsRef.current = highlights;
  personaRef.current = personaAgent;
  thinkingRef.current = thinking;

  // Ignition state — keyed by id, persists across data reloads
  const igniteAt = useRef<Map<string, number>>(new Map());
  const intensity = useRef<Map<string, number>>(new Map());
  const firedSound = useRef<Set<string>>(new Set());
  const pulsed = useRef<Set<string>>(new Set());
  const thinkStart = useRef<number | null>(null);
  // Remembered node positions, so a resize/re-render keeps the settled layout instead of re-scrambling.
  const posRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  /* DPR-aware resize */
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  /* prefers-reduced-motion is intentionally IGNORED for the brain. This is a cinematic demo, and the
     gentle idle float + firing should play for EVERYONE: respecting the OS "reduce motion" setting
     was leaving the brain dead-still on machines that have it enabled (it's on by default in some
     setups / low-power modes). `reduced` stays false so the animation always runs. */

  /* Adjacency map for hover-neighbor + bead lookup */
  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    if (!data) return m;
    for (const l of data.links) {
      const s = typeof l.source === "object" ? (l.source as any).id : l.source;
      const t = typeof l.target === "object" ? (l.target as any).id : l.target;
      if (!m.has(s)) m.set(s, new Set());
      if (!m.has(t)) m.set(t, new Set());
      m.get(s)!.add(t);
      m.get(t)!.add(s);
    }
    return m;
  }, [data]);

  /* The persistent "read circuit": the recalled/cited set + the graph edges that run BETWEEN those
     notes (the induced subgraph — the pathway the answer was read along). Recomputed only when the
     set changes; the draw loop reads these via refs so it never re-subscribes per frame. */
  const pathwaySet = useMemo(() => new Set(pathwayIds), [pathwayIds]);
  const pathwaySetRef = useRef(pathwaySet);
  pathwaySetRef.current = pathwaySet;
  // The connecting tree (a nearest-neighbour MST over the circuit notes' SCREEN positions — connects
  // ALL of them with short glowing lines) is recomputed in the draw loop when the set changes, since
  // node positions live in the sim there. These refs hold it across frames.
  const pathwayMstRef = useRef<[string, string][]>([]);
  const pathwayMstKeyRef = useRef<Set<string> | null>(null);

  /* RETRIEVED notes light up progressively as tools resolve — the "actively querying" scan.
     Only NEW ids are seeded (guarded), each staggered from now so every batch flows in. */
  useEffect(() => {
    if (researchIds.length === 0) return;
    const now = performance.now();
    // On stage, light retrieved nodes one at a time, clearly sequential (the "watch it
    // read your brain" beat); in the live view keep the quick 75ms scan.
    const step = reduced.current ? 0 : stage ? 300 : STAGGER_MS;
    let k = 0;
    for (const id of researchIds) {
      const ex = igniteAt.current.get(id);
      if (ex === undefined || now > ex + IGNITE_TOTAL_MS + PHASE.fadeOut) {
        igniteAt.current.set(id, now + k * step);
        intensity.current.set(id, 1);
        firedSound.current.delete(id);
        pulsed.current.delete(id);
        k++;
      }
    }
  }, [researchIds]);

  /* CITED notes — final emphasis. Force a fresh pulse on the cited subset, demote everything
     else that lit during research so it fades, and fit the camera onto the cited cluster. */
  useEffect(() => {
    if (highlights.length === 0) return;
    const now = performance.now();
    const step = reduced.current ? 0 : stage ? 220 : staggerFor(highlights.length);
    const citedSet = new Set(highlights);
    highlights.forEach((id, k) => {
      igniteAt.current.set(id, now + k * step);
      intensity.current.set(id, 1);
      firedSound.current.delete(id);
      pulsed.current.delete(id);
    });
    // Non-cited research nodes: jump them to the start of their fade so only cited remain lit.
    for (const [id] of igniteAt.current) {
      if (!citedSet.has(id)) {
        igniteAt.current.set(id, now - (PHASE.settleStart + PHASE.sustainHold));
      }
    }
    // Note: no camera move here — the view stays put when results arrive.
  }, [highlights]);

  /* -------------------------------------------------------------------------
   * Main effect: simulation + input + render loop. Re-runs only on data/size.
   * ------------------------------------------------------------------------ */
  useEffect(() => {
    if (!canvasRef.current || !data || size.width === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    clearSpriteCache(dpr);

    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;

    const nodeCount = data.nodes.length;
    const isProd = nodeCount > PROD_NODE_THRESHOLD;

    /* --- Simulation --- */
    const nodes: GraphNode[] = data.nodes.map((n) => ({ ...n }));
    // Hash the id → colour + phase ONCE here. These are constant per node, but were being recomputed
    // (string hash over every id) for ~2200 nodes across two draw passes EVERY frame — pure waste.
    for (const n of nodes) {
      n._baseHex = stage ? stageColor(hashSeed(n.id)) : paletteHex(n.group);
      n._phase = hashPhase(n.id);
    }
    const links: GraphLink[] = data.links.map((l) => {
      const s = typeof l.source === "object" ? (l.source as GraphNode).id : (l.source as string);
      const t = typeof l.target === "object" ? (l.target as GraphNode).id : (l.target as string);
      return { ...l, _ph: hashPhase(`${s}~${t}`) };
    });
    const idMap = new Map(nodes.map((n) => [n.id, n] as const));
    // Seed from remembered positions so a resize re-uses the settled layout (no re-scramble).
    // (Stage always starts fresh from the dormant brain silhouette — see below.)
    if (!stage) {
      for (const n of nodes) {
        const p = posRef.current.get(n.id);
        if (p) { n.x = p.x; n.y = p.y; }
      }
    }

    const radialTarget = Math.min(size.width, size.height) * 0.4;
    const cx = size.width / 2;
    const cy = size.height / 2; // world layout stays centred (globe-aligned); the woken network is dropped by the camera only
    const maxDegree = Math.max(1, ...nodes.map((n) => n.degree));
    // Stable per-index pseudo-random (0..1) — gives each standalone note its own radial target so the
    // group fills the whole disk instead of stacking on one ring. Deterministic (no Math.random).
    const rndR = (i: number) => { const x = Math.sin(i * 91.7 + 47.3) * 43758.5453; return x - Math.floor(x); };
    const sim = forceSimulation<GraphNode>(nodes)
      .force("link", forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance(54).strength(0.1))
      .force("charge", forceManyBody<GraphNode>().strength((d) => -240 - d.val * 50).distanceMax(650).theta(0.95))
      .force("center", forceCenter<GraphNode>(cx, cy).strength(0.04))
      .force("centerX", forceX<GraphNode>(cx).strength(0.05))
      .force("centerY", forceY<GraphNode>(cy).strength(0.05))
      // The radial gives the network its SPREAD (~0.4·min radius), so the wake EXPANDS outward from
      // the smaller sphere — without it the graph collapsed to the centre and the wake contracted.
      // STANDALONE notes (degree 0) have no links to pull them inward, so a fixed radius parks them all
      // on the outer ring (the "circle outside the cloud"). Give each its OWN random target radius
      // (0.1–1.0·R) at a slightly firmer pull → they scatter THROUGH the connected cloud instead.
      // Connected notes keep the exact original ring radius + strength (left untouched, as asked).
      .force("radial", forceRadial<GraphNode>(
          (d: GraphNode, i: number) => (d.degree === 0 ? (0.1 + 0.9 * rndR(i)) * radialTarget : radialTarget),
          cx, cy,
        ).strength((d) => (d.degree === 0 ? 0.04 : 0.018)))
      // Bigger collision radius reserves breathing room for labels, not just node bodies.
      .force("collide", forceCollide<GraphNode>().radius((d) => Math.max(8, nodeRadius2D(d.val)) + 7).iterations(2))
      .alphaDecay(0.02)
      .velocityDecay(0.3)
      .alphaMin(0.006);
    if (stage) {
      // Keep the original well-tuned layout (its sphere→network EXPAND is the one that felt right),
      // and add ONLY a gentle extra pull so the biggest hub sits roughly in the MIDDLE — the user's
      // "main node in the centre, its connections around it" — without collapsing the spread.
      sim
        .force("hubX", forceX<GraphNode>(cx).strength((d) => 0.08 * (d.degree / maxDegree)))
        .force("hubY", forceY<GraphNode>(cy).strength((d) => 0.08 * (d.degree / maxDegree)));
    }

    // Warm the layout off-screen so large graphs load close to settled (less on-screen drift),
    // then let it cool and HOLD STILL. No perpetual reheat — constant jitter reads as "loud"
    // at hundreds of nodes. Drag/hover still re-energize on demand; the graph's "aliveness"
    // comes from the glow breathing + occasional spontaneous synapse, not positional motion.
    if (!stage && nodeCount > 150) { const warm = nodeCount > 1000 ? 60 : 100; for (let i = 0; i < warm; i++) sim.tick(); }

    // STAGE: precompute the SETTLED neural-network layout up front. The wake is then a
    // smooth, deterministic morph (sphere → these exact targets) — not a force scramble.
    // Warm the sim, snapshot every node's resting spot, then stop it cold.
    const stageTarget = stage ? new Map<string, { x: number; y: number }>() : null;
    if (stage) {
      const warm = nodeCount > 800 ? 140 : 240;
      for (let i = 0; i < warm; i++) sim.tick();
      // Standalone (degree-0) notes have no links to hold them, so the forces fling them to an outer
      // ring. Scatter them IN AMONG the settled connected cloud (jittered around random connected
      // notes) so they fill the gaps between clusters instead of orbiting outside.
      const connected = nodes.filter((n) => n.degree > 0 && n.x != null && n.y != null);
      if (connected.length) {
        const rnd = (s: number) => {
          const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
          return x - Math.floor(x);
        };
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          if (n.degree > 0) continue;
          const c = connected[Math.floor(rnd(i * 3 + 1) * connected.length)];
          const ang = rnd(i * 3 + 2) * Math.PI * 2;
          const rr = 8 + rnd(i * 3 + 3) * 52;
          n.x = c.x! + Math.cos(ang) * rr;
          n.y = c.y! + Math.sin(ang) * rr;
        }
      }
      for (const n of nodes) stageTarget!.set(n.id, { x: n.x ?? cx, y: n.y ?? cy });
      sim.alpha(0); sim.stop();
    }

    /* --- Stage flow: dormant 3D node-sphere → "wake up" → neural network ---------
       A high-end depth-lit globe of nodes (Fibonacci lattice, limb/Fresnel glow + key
       light + luminous core). On wake EVERY node morphs — eased, center-out staggered —
       straight to its precomputed network target (no force jitter). The wireframe
       crossfades to wikilinks; the camera eases out to frame the whole net. */
    let brainEdges: [number, number][] = [];
    const releaseDelay = new Float64Array(nodes.length);
    const stageHidden = new Uint8Array(nodes.length); // 1 = overflow node (not on the globe)
    const stageDepth = new Float64Array(nodes.length).fill(1); // 0 (far) .. 1 (near) — drives size
    const stageRim = new Float64Array(nodes.length);   // 0..1 limb (Fresnel) glow
    const stageLight = new Float64Array(nodes.length); // 0..1 key-light highlight
    const stageRadial = new Float64Array(nodes.length).fill(1); // per-node radial offset (rough silhouette)
    const stageFrom = stage ? new Float64Array(nodes.length * 2) : null; // dormant pos (morph start)
    // Sphere globe state — non-null on stage; gates the 3D shading in the draw loop.
    let sphereUnit: ({ x: number; y: number; z: number } | null)[] | null = null;
    let sphereCX = 0, sphereCY = 0, sphereScreenR = 0; // screen-space center + radius (core bloom)
    let wakeT0: number | null = null;
    let prevWoken = wokenRef.current;
    let stageFitted = false;   // one-shot: frame the network centered as it forms
    let stageShifted = false;  // one-shot: glide the network left + reveal the greeting
    let morphReleased = false; // one-shot: unpin once the morph lands
    // Shared sphere shading params (setup projection + per-frame rotation use the same).
    const SPH_COST = Math.cos(0.42), SPH_SINT = Math.sin(0.42); // fixed 3/4 tilt
    const SPH_LX = -0.5, SPH_LY = -0.62, SPH_LZ = 0.6, SPH_LN = Math.hypot(-0.5, -0.62, 0.6); // key light
    const SPH_ROT = 0.00006; // rad/ms yaw — VERY slow (~105s per revolution)
    if (stage) {
      const K = Math.min(nodeCount, 2500); // dense point-cloud globe — fits the whole blob brain
      const brainIdx = nodes.map((_, i) => i).sort((a, b) => nodes[b].degree - nodes[a].degree).slice(0, K);
      const brainSet = new Set(brainIdx);
      const sph = computeSphereShape(K, size.width, size.height, 1);
      sphereCX = sph.center.x; sphereCY = sph.center.y; sphereScreenR = sph.radius; // globe stays centred (NOT shifted)
      sphereUnit = new Array(nodes.length).fill(null);
      // Initial projection at the fixed 3/4 tilt; the draw loop re-projects each frame as it
      // slowly rotates. Per node: depth (near/far), limb glow (Fresnel), key-light highlight.
      for (let i = 0; i < K; i++) {
        const ni = brainIdx[i];
        const u = sph.unit[i];
        sphereUnit[ni] = u;
        stageRadial[ni] = sph.radial[i];
        releaseDelay[ni] = sph.releaseDelay[i] * 0.7; // center blooms first
        const y2 = u.y * SPH_COST - u.z * SPH_SINT; // tilt around the horizontal axis
        const z2 = u.y * SPH_SINT + u.z * SPH_COST;
        nodes[ni].x = sph.center.x + u.x * sph.radius * sph.radial[i];
        nodes[ni].y = sph.center.y + y2 * sph.radius * sph.radial[i];
        stageDepth[ni] = (z2 + 1) / 2; // 0 far .. 1 near
        const projR = Math.min(1, Math.hypot(u.x, y2)); // 0 center .. 1 silhouette edge
        stageRim[ni] = projR * projR * projR; // glow concentrated at the limb
        stageLight[ni] = Math.max(0, (u.x * SPH_LX + y2 * SPH_LY + z2 * SPH_LZ) / SPH_LN); // normal·light
      }
      brainEdges = sph.edges.map(([a, b]) => [brainIdx[a], brainIdx[b]] as [number, number]);
      const ccx = sph.center.x, ccy = sph.center.y;
      const hiddenR = Math.min(size.width, size.height) * 0.4;
      for (let i = 0; i < nodes.length; i++) {
        if (brainSet.has(i)) continue;
        stageHidden[i] = 1;
        // Overflow nodes (vault bigger than the globe) wait pre-spread, fading in on wake.
        const ang = (i * 2.399963) % (Math.PI * 2);
        const rr = Math.sqrt(((i * 53) % 101) / 101) * hiddenR;
        nodes[i].x = ccx + Math.cos(ang) * rr;
        nodes[i].y = ccy + Math.sin(ang) * rr;
        releaseDelay[i] = 0.4 + 0.55 * (((i * 97) % 101) / 101);
      }
      // Snapshot dormant positions — the morph eases from here to stageTarget.
      for (let i = 0; i < nodes.length; i++) {
        stageFrom![2 * i] = nodes[i].x!; stageFrom![2 * i + 1] = nodes[i].y!;
      }
      if (wokenRef.current) {
        // Re-mounted already awake (unusual): skip the morph, land on targets.
        wakeT0 = performance.now() - 5000;
        morphReleased = true;
        for (const n of nodes) { const t = stageTarget!.get(n.id)!; n.x = t.x; n.y = t.y; n.fx = null; n.fy = null; }
      } else {
        for (const n of nodes) { n.fx = n.x; n.fy = n.y; }
        sim.alpha(0); sim.stop();
      }
    }

    /* --- Hover/scale anim state --- */
    const anims = new Map<string, NodeAnim>();
    const getAnim = (id: string) => {
      let a = anims.get(id);
      if (!a) {
        a = { alpha: 1, targetAlpha: 1, scale: 1, targetScale: 1, label: 0, targetLabel: 0 };
        anims.set(id, a);
      }
      return a;
    };

    // Reused per-frame scratch — cleared each frame to avoid GC churn in the hot loop.
    const litK = new Map<string, number>();
    const flashK = new Map<string, number>();
    const hoverSet = new Set<string>();
    const toCleanup: string[] = [];

    // Idle drift — once settled, EVERY node visibly floats around its resting anchor on its own
    // slow, desynced path (summed sines → organic, non-repeating); hubs swing widest. It's a
    // render-time offset, NOT a force, so there's no tug-of-war reheat; anchors capture on
    // settle and drop whenever the sim re-energizes (drag) so it re-anchors afterwards.
    // `driftLit` records how fast each hub is moving this frame so its links can shimmer.
    const driftAnchor = new Map<string, { x: number; y: number }>();
    const driftLit = new Map<string, number>();
    const degSorted = nodes.map((n) => n.degree).sort((a, b) => a - b);
    const maxDeg = degSorted[degSorted.length - 1] ?? 1;
    const mainCut = Math.max(4, degSorted[Math.floor(degSorted.length * 0.82)] ?? 0); // only the top hubs drift

    /* --- Ambient dust (world space, around the sphere) --- */
    const dustCount = isProd ? 0 : nodeCount > 800 ? DUST_PROD : DUST_DEV;
    const dust: Dust[] = Array.from({ length: dustCount }, () => {
      const ang = Math.random() * Math.PI * 2;
      const rad = radialTarget * (0.2 + Math.random() * 1.5);
      return {
        x: cx + Math.cos(ang) * rad,
        y: cy + Math.sin(ang) * rad,
        phx: Math.random() * Math.PI * 2,
        phy: Math.random() * Math.PI * 2,
        r: 0.5 + Math.random() * 1.0,
        hue: Math.random() < 0.5 ? "#a78bfa" : "#22d3ee",
      };
    });

    /* --- Bead pool (action-potential pulses) --- stage runs a far richer cascade, so it gets a
       bigger pool of concurrent pulses. */
    const beads: Bead[] = Array.from({ length: stage ? 320 : PULSE_BUDGET }, () => ({
      active: false, sx: 0, sy: 0, tx: 0, ty: 0, tid: "", t0: 0, depth: 0,
    }));
    function spawnBead(sx: number, sy: number, t: GraphNode, depth: number) {
      const slot = beads.find((b) => !b.active);
      if (!slot || t.x == null) return;
      slot.active = true; slot.sx = sx; slot.sy = sy;
      slot.tx = t.x!; slot.ty = t.y!; slot.tid = t.id; slot.t0 = performance.now(); slot.depth = depth;
    }

    /* --- Stage neural cascade: the persistent record of every node fired + edge walked this
       query (the "paths the neurons walked on"). Reset when the read-circuit empties — i.e. the
       next prompt begins (see the pSet-reset below). `fireHop` tracks each node's distance from a
       seed (drives the per-hop intensity falloff + caps depth); `fireClaimed` stops two cascades
       racing for the same node, so the frontier expands cleanly outward. --- */
    const firedNodes = new Set<string>();
    const firedEdges = new Map<string, { a: string; b: string; t0: number }>();
    const fireHop = new Map<string, number>();
    const fireClaimed = new Set<string>();

    /* --- Background (cached, blitted once/frame; drifts at ~6fps) --- */
    const bg = document.createElement("canvas");
    bg.width = size.width; bg.height = size.height;
    const bgCtx = bg.getContext("2d")!;
    const noise = makeNoiseTile();
    function drawBg(phase: number) {
      const w = size.width, h = size.height, mn = Math.min(w, h);
      if (stage) {
        // Deep navy-black with a soft central bloom + vignette + grain (matches the reference).
        bgCtx.globalCompositeOperation = "source-over";
        bgCtx.fillStyle = STAGE_BG; bgCtx.fillRect(0, 0, w, h);
        bgCtx.globalCompositeOperation = "lighter";
        const cg = bgCtx.createRadialGradient(w / 2, h * 0.46, 0, w / 2, h * 0.46, mn * 0.72);
        cg.addColorStop(0, "rgba(34,211,238,0.06)");
        cg.addColorStop(0.5, "rgba(59,130,246,0.03)");
        cg.addColorStop(1, "rgba(34,211,238,0)");
        bgCtx.fillStyle = cg; bgCtx.fillRect(0, 0, w, h);
        bgCtx.globalCompositeOperation = "source-over";
        const sv = bgCtx.createRadialGradient(w / 2, h * 0.46, mn * 0.22, w / 2, h * 0.5, Math.max(w, h) * 0.8);
        sv.addColorStop(0, "rgba(2,4,10,0)"); sv.addColorStop(1, "rgba(1,2,6,0.7)");
        bgCtx.fillStyle = sv; bgCtx.fillRect(0, 0, w, h);
        bgCtx.globalAlpha = 0.03; bgCtx.globalCompositeOperation = "overlay";
        for (let y = 0; y < h; y += 128) for (let x = 0; x < w; x += 128) bgCtx.drawImage(noise, x, y);
        bgCtx.globalAlpha = 1; bgCtx.globalCompositeOperation = "source-over";
        return;
      }
      bgCtx.globalCompositeOperation = "source-over";
      const lg = bgCtx.createLinearGradient(0, 0, 0, h);
      lg.addColorStop(0, "#05040c"); lg.addColorStop(0.5, "#08070f"); lg.addColorStop(1, "#0a0816");
      bgCtx.fillStyle = lg; bgCtx.fillRect(0, 0, w, h);
      bgCtx.globalCompositeOperation = "lighter";
      const ax = w * (0.3 + Math.sin(phase) * 0.03), ay = h * (0.35 + Math.cos(phase * 0.8) * 0.03);
      const ga = bgCtx.createRadialGradient(ax, ay, 0, ax, ay, mn * 0.6);
      ga.addColorStop(0, "rgba(99,102,241,0.10)"); ga.addColorStop(1, "rgba(99,102,241,0)"); // indigo aurora
      bgCtx.fillStyle = ga; bgCtx.fillRect(0, 0, w, h);
      const bx = w * (0.72 + Math.cos(phase * 0.9) * 0.03), by = h * (0.66 + Math.sin(phase) * 0.03);
      const gb = bgCtx.createRadialGradient(bx, by, 0, bx, by, mn * 0.6);
      gb.addColorStop(0, "rgba(56,189,248,0.055)"); gb.addColorStop(1, "rgba(56,189,248,0)"); // cyan aurora
      bgCtx.fillStyle = gb; bgCtx.fillRect(0, 0, w, h);
      bgCtx.globalCompositeOperation = "source-over";
      const vg = bgCtx.createRadialGradient(w / 2, h * 0.45, mn * 0.2, w / 2, h * 0.5, Math.max(w, h) * 0.78);
      vg.addColorStop(0, "rgba(3,3,9,0)"); vg.addColorStop(1, "rgba(3,3,9,0.64)");
      bgCtx.fillStyle = vg; bgCtx.fillRect(0, 0, w, h);
      bgCtx.globalAlpha = 0.04; bgCtx.globalCompositeOperation = "overlay";
      for (let y = 0; y < h; y += 128) for (let x = 0; x < w; x += 128) bgCtx.drawImage(noise, x, y);
      bgCtx.globalAlpha = 1; bgCtx.globalCompositeOperation = "source-over";
    }
    let bgPhase = 0;
    drawBg(0);
    const bgTimer = reduced.current ? null : setInterval(() => { bgPhase += 0.04; drawBg(bgPhase); }, 166);

    /* --- Zoom / pan --- */
    let transform: ZoomTransform = zoomIdentity;
    const sel = select(canvas);
    const zoomBehavior = d3zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.05, 8])
      .filter((event) => {
        if (event.type === "wheel") return true;
        if (event.type === "mousedown" || event.type === "touchstart") {
          if (event.button === 2 || event.button === 1) return true;
          return !pickNode(event);
        }
        return true;
      })
      .on("zoom", (event) => { transform = event.transform; });
    sel.call(zoomBehavior);
    canvas.oncontextmenu = (e) => e.preventDefault();

    function pickNode(event: MouseEvent | { offsetX: number; offsetY: number }): GraphNode | null {
      const x = (event as any).offsetX, y = (event as any).offsetY;
      const wx = (x - transform.x) / transform.k, wy = (y - transform.y) / transform.k;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (n.x == null || n.y == null) continue;
        const r = Math.max(5, nodeRadius2D(n.val)) + 3;
        const dx = n.x - wx, dy = n.y - wy;
        if (dx * dx + dy * dy <= r * r) return n;
      }
      return null;
    }

    /* --- Mouse interaction (preserved) --- */
    let dragNode: GraphNode | null = null;
    let dragOffset = { x: 0, y: 0 };
    let lastMoveTime = performance.now();
    let lastMove = { x: 0, y: 0 };
    let velocity = { x: 0, y: 0 };

    function onMouseMove(e: MouseEvent) {
      const wx = (e.offsetX - transform.x) / transform.k, wy = (e.offsetY - transform.y) / transform.k;
      if (dragNode) {
        const now = performance.now();
        const dt = Math.max(8, now - lastMoveTime);
        const newX = wx - dragOffset.x, newY = wy - dragOffset.y;
        velocity.x = ((newX - lastMove.x) * 1000) / dt;
        velocity.y = ((newY - lastMove.y) * 1000) / dt;
        lastMove = { x: newX, y: newY }; lastMoveTime = now;
        dragNode.fx = newX; dragNode.fy = newY;
        sim.alphaTarget(0.06).restart();
      } else {
        // Lock hover on the stage globe until it has COLLAPSED into the network — the dormant sphere
        // rotates, so picking/scaling/labelling a node mid-spin reads as jank. (`morphReleased` flips
        // true once the wake-morph lands; it's never set in live mode, so live is unaffected.)
        if (stage && !morphReleased) {
          if (hoveredRef.current) { hoveredRef.current = null; setHovered(null); }
          canvas.style.cursor = "default";
          return;
        }
        const node = pickNode(e);
        hoveredRef.current = node?.id ?? null;
        setHovered(node?.id ?? null);
        canvas.style.cursor = node ? "pointer" : "default";
      }
    }
    function onMouseDown(e: MouseEvent) {
      if (e.button !== 0) return;
      if (stage && !morphReleased) return; // no dragging the dormant globe
      const node = pickNode(e);
      if (!node) return;
      dragNode = node;
      setDragging(true);
      const wx = (e.offsetX - transform.x) / transform.k, wy = (e.offsetY - transform.y) / transform.k;
      dragOffset = { x: wx - (node.x ?? 0), y: wy - (node.y ?? 0) };
      lastMove = { x: node.x ?? 0, y: node.y ?? 0 }; lastMoveTime = performance.now();
      velocity = { x: 0, y: 0 };
      sim.alphaTarget(0.3).restart();
      canvas.style.cursor = "grabbing";
    }
    function onMouseUp() {
      if (!dragNode) return;
      const VMAX = 600;
      dragNode.fx = null; dragNode.fy = null;
      // Soft release — small momentum, gentle re-settle (no global earthquake at scale).
      dragNode.vx = Math.max(-VMAX, Math.min(VMAX, velocity.x)) * 0.008;
      dragNode.vy = Math.max(-VMAX, Math.min(VMAX, velocity.y)) * 0.008;
      sim.alphaTarget(0).alpha(0.08).restart();
      dragNode = null; setDragging(false);
      canvas.style.cursor = "default";
    }
    function onClick(e: MouseEvent) {
      if (e.button !== 0) return;
      if (stage && !morphReleased) return; // no node selection on the dormant globe
      const node = pickNode(e);
      if (node) onNodeClick?.(node.id);
    }
    function onDblClick(e: MouseEvent) {
      e.preventDefault();
      if (!pickNode(e)) zoomToFit(true);
    }
    function onRightClick(e: MouseEvent) {
      if (e.button !== 2) return;
      const node = pickNode(e);
      if (node && node.fx != null) { node.fx = null; node.fy = null; }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Enter") return;
      e.preventDefault();
      const sorted = [...nodes].sort((a, b) => a.name.localeCompare(b.name));
      const cur = sorted.findIndex((n) => n.id === hoveredRef.current);
      if (e.key === "Enter") { if (hoveredRef.current) onNodeClick?.(hoveredRef.current); return; }
      const next = e.key === "ArrowRight"
        ? sorted[(cur + 1 + sorted.length) % sorted.length]
        : sorted[(cur - 1 + sorted.length) % sorted.length];
      hoveredRef.current = next.id; setHovered(next.id);
    }

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", () => { onMouseUp(); hoveredRef.current = null; setHovered(null); });
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("dblclick", onDblClick);
    canvas.addEventListener("mousedown", onRightClick);
    canvas.addEventListener("keydown", onKeyDown);

    /* --- Zoom-to-fit (all nodes, or a subset of ids) --- */
    function zoomToFit(
      animate = false,
      subset?: string[],
      opts?: { pad?: number; maxScale?: number; duration?: number }
    ) {
      const pool = subset && subset.length ? subset.map((id) => idMap.get(id)).filter(Boolean) as GraphNode[] : nodes;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of pool) {
        if (n.x == null || n.y == null) continue;
        minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y);
      }
      if (!isFinite(minX)) return;
      const w = maxX - minX, h = maxY - minY;
      const ccx = (minX + maxX) / 2, ccy = (minY + maxY) / 2;
      const pad = opts?.pad ?? (subset ? 220 : 80);
      const cap = opts?.maxScale ?? (subset ? 1.6 : 1.2);
      const scale = Math.min(size.width / (w + pad), size.height / (h + pad), cap);
      const target = zoomIdentity.translate(size.width / 2 - ccx * scale, size.height / 2 - ccy * scale).scale(scale);
      if (animate) (sel as any).transition().duration(opts?.duration ?? 900).call(zoomBehavior.transform, target);
      else sel.call(zoomBehavior.transform, target);
    }
    // Stage: ease the camera so the network (its KNOWN targets) frames into a region —
    // cxFrac = horizontal center (0.5 = middle, <0.5 = pushed left), wFrac = width share.
    function fitStage(cxFrac: number, wFrac: number, dur: number) {
      if (!stageTarget) return;
      let mnX = Infinity, mnY = Infinity, mxX = -Infinity, mxY = -Infinity;
      stageTarget.forEach((p) => {
        mnX = Math.min(mnX, p.x); mnY = Math.min(mnY, p.y);
        mxX = Math.max(mxX, p.x); mxY = Math.max(mxY, p.y);
      });
      if (!isFinite(mnX)) return;
      const bw = mxX - mnX, bh = mxY - mnY, bcx = (mnX + mxX) / 2, bcy = (mnY + mxY) / 2;
      const pad = 200;
      const scl = Math.min((size.width * wFrac) / (bw + pad), size.height / (bh + pad), 0.85);
      const tf = zoomIdentity.translate(size.width * cxFrac - bcx * scl, size.height / 2 + STAGE_DY - bcy * scl).scale(scl);
      (sel as any).transition().duration(dur).call(zoomBehavior.transform, tf);
    }

    const fitTimer = stage ? null : setTimeout(() => zoomToFit(true), 1200);

    /* --- Render loop --- */
    let raf: number;
    let lastSpont = performance.now();
    let nextSpontGap = 6000 + Math.random() * 4000;
    let waitDim = 1; // eased dim of non-hit nodes while an answer is up (stage)

    function draw() {
      const now = performance.now();
      const k = transform.k;
      const hl = highlightsRef.current;
      const hoveredId = hoveredRef.current;
      const persona = personaRef.current;

      // ── Stage wake: a smooth, deterministic MORPH from the dormant globe to the
      //    precomputed neural-network layout. No force sim → no jitter. ──
      const STAGE_MORPH = 1500;   // ms per-node morph duration
      const STAGE_STAGGER = 700;  // ms center-out release spread
      let brainFade = 0, wikiFade = 1;
      let wakeP = 0; // 0 dormant .. 1 woken — flattens the 3D shading as it morphs
      if (stage) {
        const wokenNow = wokenRef.current;

        // Dormant: slowly rotate the globe — re-project every node + recompute its depth,
        // limb glow, and key-light each frame (the rough radial offsets ride along).
        if (sphereUnit && wakeT0 == null) {
          const yaw = now * SPH_ROT;
          const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
          for (let i = 0; i < nodes.length; i++) {
            const u = sphereUnit[i];
            if (!u) continue;
            const x1 = u.x * cosY + u.z * sinY;       // yaw around vertical axis
            const z1 = -u.x * sinY + u.z * cosY;
            const y2 = u.y * SPH_COST - z1 * SPH_SINT; // tilt around horizontal axis
            const z2 = u.y * SPH_SINT + z1 * SPH_COST;
            const rad = sphereScreenR * stageRadial[i];
            const n = nodes[i];
            n.x = sphereCX + x1 * rad; n.y = sphereCY + y2 * rad;
            n.fx = n.x; n.fy = n.y;
            stageDepth[i] = (z2 + 1) / 2;
            const projR = Math.min(1, Math.hypot(x1, y2));
            stageRim[i] = projR * projR * projR;
            stageLight[i] = Math.max(0, (x1 * SPH_LX + y2 * SPH_LY + z2 * SPH_LZ) / SPH_LN);
          }
        }

        if (wokenNow && !prevWoken) {
          wakeT0 = now; // begin the morph — freeze the globe's current rotated pose as its start
          for (let i = 0; i < nodes.length; i++) {
            stageFrom![2 * i] = nodes[i].x!; stageFrom![2 * i + 1] = nodes[i].y!;
          }
        }
        prevWoken = wokenNow;

        if (wakeT0 == null) {
          brainFade = 1; wikiFade = 0; // dormant globe
        } else {
          const tAll = now - wakeT0;
          wakeP = clamp01(tAll / (STAGE_MORPH + STAGE_STAGGER));
          const END = STAGE_MORPH + STAGE_STAGGER + 200;
          if (tAll < END) {
            // Ease every node from its dormant spot to its network target (center-out).
            for (let i = 0; i < nodes.length; i++) {
              const n = nodes[i];
              const tgt = stageTarget!.get(n.id)!;
              const p = easeInOutCubic(clamp01((tAll - releaseDelay[i] * STAGE_STAGGER) / STAGE_MORPH));
              n.x = lerp(stageFrom![2 * i], tgt.x, p);
              n.y = lerp(stageFrom![2 * i + 1], tgt.y, p);
              n.fx = n.x; n.fy = n.y; // hold — a stray tick can't fight the morph
            }
          } else if (!morphReleased) {
            morphReleased = true; // land exactly + unpin so drag/hover work
            for (const n of nodes) {
              const tgt = stageTarget!.get(n.id)!;
              n.x = tgt.x; n.y = tgt.y; n.fx = null; n.fy = null;
            }
          }
          brainFade = clamp01(1 - tAll / 1300);
          wikiFade = clamp01((tAll - 200) / 1400);

          // Beat 1 — as the web forms, frame the whole network centered (zoomed out).
          if (!stageFitted && tAll > 950) { stageFitted = true; fitStage(0.5, 0.92, 1500); }
          // Beat 2 — once expansion is complete, glide the network to the LEFT and reveal
          //          the greeting on the right (StageGreeting reacts to `expanded`). Framed so the
          //          brain's right edge clears the greeting/answer rail (its left edge is ~50% of W),
          //          and it HOLDS here (no further camera move) for the rest of the session.
          if (!stageShifted && tAll > END + 250) {
            stageShifted = true;
            fitStage(0.27, 0.5, 1200);
            usePresentation.getState().setExpanded(true);
          }
        }
      }
      // 3D shading (stage only): front bright/large, far side dim/small, a bright limb
      // (Fresnel) + key-light highlight — all flatten to the plain network look on wake.
      const depthOf = (i: number): number =>
        stage && sphereUnit ? lerp(stageDepth[i], 1, wakeP) : 1;
      const shadeBrightOf = (i: number): number => {
        if (!(stage && sphereUnit)) return 1;
        const d = stageDepth[i], l = stageLight[i], r = stageRim[i];
        const dormant = 0.3 + 0.5 * d + 0.5 * l * (0.4 + 0.6 * d) + 0.75 * r;
        return lerp(Math.min(1.8, dormant), 1, wakeP);
      };
      const rimMixOf = (i: number): number =>
        stage && sphereUnit ? lerp(clamp01(0.7 * stageRim[i] + 0.45 * stageLight[i] * stageDepth[i]), 0, wakeP) : 0;
      // Per-node reveal: overflow stage nodes fade in as the morph reaches them.
      const revealOf = (i: number): number => {
        if (!stage || stageHidden[i] === 0) return 1;
        if (wakeT0 == null) return 0;
        return clamp01((now - wakeT0 - releaseDelay[i] * STAGE_STAGGER) / 700);
      };
      // The DORMANT sphere is now a DENSE ~2,500-node point cloud, so its dots read SMALLER and glow
      // SOFTER than the spread-out woken network. Both ease back to full as it wakes (wakeP 0→1).
      const sphereSizeMul = stage && sphereUnit ? lerp(0.55, 1, wakeP) : 1;
      const sphereGlowMul = stage && sphereUnit ? lerp(0.6, 1, wakeP) : 1;
      // Stage uses a multi-hue cyan-dominant palette + cyan-white lit cores; live keeps violet.
      const baseHexFor = (n: GraphNode) => n._baseHex ?? (stage ? stageColor(hashSeed(n.id)) : paletteHex(n.group));
      const litHaloC = stage ? "#9fefff" : litHaloHex();
      const litCoreC = stage ? STAGE_LIT : litCoreHex();
      const linkIdleC = stage ? STAGE_LINK : LINK_IDLE;

      // "Thinking" glow — query in flight, no results yet. Every node breathes a soft
      // bioluminescent shimmer on its OWN desynced phase (a field of neurons idling),
      // tinted toward the active agent. No directional sweep; pure per-node glow.
      const thinkActive = thinkingRef.current && !reduced.current && nodes.length > 0;
      if (thinkActive) {
        if (thinkStart.current == null) thinkStart.current = now;
      } else {
        thinkStart.current = null;
      }
      // Ease in over 450ms so it swells up rather than popping.
      const thinkRamp = thinkActive ? clamp01((now - (thinkStart.current ?? now)) / 450) : 0;
      // Per-node oscillation: phase-offset by node id so they shimmer out of sync.
      const thinkOsc = (ph: number) => 0.5 + 0.5 * Math.sin(now * 0.0045 + ph * 1.7);

      // Spontaneous idle synapse (paused while thinking so the sweep reads cleanly)
      if (!reduced.current && !thinkingRef.current && !answeredRef.current && hl.length === 0 && now - lastSpont > nextSpontGap && nodes.length) {
        const n = nodes[(Math.random() * nodes.length) | 0];
        if (!igniteAt.current.has(n.id)) {
          igniteAt.current.set(n.id, now);
          intensity.current.set(n.id, 0.33);
          firedSound.current.add(n.id);
        }
        lastSpont = now; nextSpontGap = 6000 + Math.random() * 4000;
      }

      // Hover focus set (reused; no per-frame allocation)
      hoverSet.clear();
      let activeSet: Set<string> | null = null;
      if (hoveredId) {
        hoverSet.add(hoveredId);
        neighbors.get(hoveredId)?.forEach((nb) => hoverSet.add(nb));
        activeSet = hoverSet;
      }

      // Lit lookup (reused maps; defer deletes so we never mutate the Map mid-iteration)
      litK.clear();
      flashK.clear();
      toCleanup.length = 0;
      for (const [id, start] of igniteAt.current) {
        const age = now - start;
        if (age < 0) { litK.set(id, 0); continue; }
        const scaleI = intensity.current.get(id) ?? 1;
        // On stage, hold lit nodes much longer so each stays lit through the whole
        // retrieval (until the answer demotes the non-cited ones).
        const litUntil = start + PHASE.settleStart + (stage ? 30000 : PHASE.sustainHold);
        let lk: number;
        if (reduced.current) {
          if (age < 200) lk = easeOutExpo(age / 200);
          else if (now < litUntil) lk = 1;
          else { const f = clamp01((now - litUntil) / PHASE.fadeOut); lk = 1 - f; if (f >= 1) toCleanup.push(id); }
        } else if (age < PHASE.settleStart) {
          lk = Math.min(1, easeOutExpo(age / 200));
        } else if (now < litUntil) {
          lk = lerp(1, 0.55, clamp01((age - PHASE.settleStart) / PHASE.sustainHold));
        } else {
          const f = clamp01((now - litUntil) / PHASE.fadeOut);
          lk = lerp(0.55, 0, f);
          if (f >= 1) toCleanup.push(id);
        }
        litK.set(id, lk * scaleI);
        // Size-flash: disabled under reduced-motion + peak-clamped (anti-strobe, WCAG 2.3.3)
        let fk = 0;
        if (!reduced.current && age >= 0 && age < 400) {
          fk = Math.min(0.6, age < 120 ? age / 120 : Math.max(0, 1 - (age - 120) / 280));
        }
        flashK.set(id, fk * scaleI);
        // fire-once marker for bead spawn (node-hit sound removed — it was too obnoxious)
        if (age >= 0 && !firedSound.current.has(id)) {
          firedSound.current.add(id);
        }
        if (!reduced.current && age >= PHASE.pulseSpawn && !pulsed.current.has(id) && (intensity.current.get(id) ?? 1) >= 0.5) {
          pulsed.current.add(id);
          const src = idMap.get(id);
          if (src && src.x != null) {
            if (stage) {
              // This neuron fires: send pulses along its real links to a few un-fired neighbours.
              // Each lands, lights up and fires onward (handled on bead arrival) → the cascade
              // spreads outward hop by hop. Seeds (intensity 1) start at hop 0.
              const seed = (intensity.current.get(id) ?? 1) >= 0.999;
              const hop = seed ? 0 : (fireHop.get(id) ?? 0);
              fireHop.set(id, hop);
              firedNodes.add(id); fireClaimed.add(id);
              if (hop < FIRE_MAX_HOP && firedNodes.size < FIRE_NODE_CAP && firedEdges.size < FIRE_EDGE_CAP) {
                let sent = 0;
                const nbrs = neighbors.get(id);
                if (nbrs) {
                  for (const nb of nbrs) {
                    if (sent >= FIRE_FANOUT || firedNodes.size + sent >= FIRE_NODE_CAP || firedEdges.size >= FIRE_EDGE_CAP) break;
                    if (fireClaimed.has(nb)) continue;
                    const t = idMap.get(nb);
                    if (!t || t.x == null) continue;
                    fireClaimed.add(nb);
                    fireHop.set(nb, hop + 1);
                    const ek = edgeKey(id, nb);
                    if (!firedEdges.has(ek)) firedEdges.set(ek, { a: id, b: nb, t0: now });
                    spawnBead(src.x!, src.y!, t, hop + 1); // depth carries the target's hop number
                    sent++;
                  }
                }
              }
            } else {
              const depth = (intensity.current.get(id) ?? 1) < 0.5 ? 1 : 0;
              neighbors.get(id)?.forEach((nb) => {
                const t = idMap.get(nb);
                if (t) spawnBead(src.x!, src.y!, t, depth);
              });
            }
          }
        }
      }
      for (const id of toCleanup) {
        igniteAt.current.delete(id); intensity.current.delete(id);
        firedSound.current.delete(id); pulsed.current.delete(id);
      }

      const litSet = litK;

      // FOCUS / read-circuit dim: ease every non-circuit node down to a subtle dim so the lit
      // pathway reads clearly ("blurring the rest does the trick"). On STAGE this is the transient
      // "answered" beat; in LIVE it's the PERSISTENT read-circuit (pathwaySet) that stays until the
      // next prompt. Suspended while hovering so exploration isn't fought.
      const pathway = pathwaySetRef.current;
      // While THINKING (querying, no notes read yet) NOTHING dims — every node glows the thinking
      // shimmer. The focus dim only engages once the read-circuit has notes (results landing).
      const pathwayFocus = !hoveredId && !thinkActive && pathway.size > 0; // live OR stage
      const answeredNow = answeredRef.current && !hoveredId && litSet.size > 0;
      const focusNow = answeredNow || pathwayFocus;
      // a live/stage read-circuit dims a touch harder (0.3) than the bare stage "answered" beat (0.42).
      waitDim += ((focusNow ? (pathwayFocus ? 0.3 : 0.42) : 1) - waitDim) * 0.06;
      let hitSet: Set<string> | null = null;
      if (focusNow) {
        hitSet = new Set<string>();
        for (const [id, v] of litSet) if (v > 0.05) hitSet.add(id);
        for (const id of pathway) hitSet.add(id); // circuit notes stay bright through the dim
        if (stage) for (const id of firedNodes) hitSet.add(id); // the whole walked network stays lit
        if (hitSet.size === 0) hitSet = null;
      }

      // ── Idle free-float: EVERY node visibly drifts once the layout has settled — each on its own
      //    slow, desynced path (summed sines = organic, non-repeating). It's a render-time offset,
      //    NOT a force (no tug-of-war reheat). Hubs swing widest; the rest float slightly. As a hub
      //    moves, `driftLit` records its envelope so its links shimmer brighter mid-swing.
      //    Excluded while: reduced-motion, dragging, the dormant globe, or mid wake-morph.
      const morphDone = !stage || (wakeT0 != null && now - wakeT0 >= STAGE_MORPH + STAGE_STAGGER + 200);
      const driftIdle =
        !reduced.current && !dragNode && morphDone && !(stage && wakeT0 == null) && sim.alpha() < 0.015;
      driftLit.clear();
      if (driftIdle) {
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          if (n.x == null || n.y == null || n.fx != null) continue; // pinned/dragged stay put
          // EVERY node floats now (same summed-sine path the hubs use). Hubs still swing widest
          // (~6–13 world px, scaled by degree); every other node gets a slight ~4px version so the
          // whole web breathes.
          const isMain = n.degree >= mainCut;
          const amp = isMain
            ? 6 + 7 * clamp01((n.degree - mainCut) / Math.max(1, maxDeg - mainCut))
            : 4;
          let anc = driftAnchor.get(n.id);
          if (!anc) { anc = { x: n.x, y: n.y }; driftAnchor.set(n.id, anc); }
          const ph = n._phase ?? 0;
          const px = now * 0.0006 + ph, sx = now * 0.0011 + ph * 2.3;
          const py = now * 0.00052 + ph * 1.7, sy = now * 0.00094 + ph * 1.3;
          n.x = anc.x + Math.sin(px) * amp + Math.sin(sx) * amp * 0.4;
          n.y = anc.y + Math.cos(py) * amp + Math.cos(sy) * amp * 0.4;
          // motion envelope (~1 mid-swing, ~0 at turnarounds) drives link shimmer — keep it to the
          // HUBS only so the link web stays calm even though every node is now moving.
          if (isMain) driftLit.set(n.id, clamp01((Math.abs(Math.cos(px)) + 0.4 * Math.abs(Math.cos(sx))) / 1.4));
        }
      } else if (driftAnchor.size) {
        driftAnchor.clear(); // re-anchor on the next settle
      }

      /* paint */
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.drawImage(bg, 0, 0, size.width, size.height);
      ctx.translate(transform.x, transform.y);
      ctx.scale(k, k);

      // viewport AABB (world space) + 64px inflate
      const vx0 = -transform.x / k - 64, vy0 = -transform.y / k - 64;
      const vx1 = (size.width - transform.x) / k + 64, vy1 = (size.height - transform.y) / k + 64;
      const inView = (x?: number, y?: number) => x != null && y != null && x >= vx0 && x <= vx1 && y >= vy0 && y <= vy1;

      /* LINKS (additive) */
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";

      // STAGE: luminous plasma core behind the globe — gives the point-cloud a glowing
      //        heart so it reads as a rendered orb, not flat dots. Fades out on wake.
      if (stage && brainFade > 0.01) {
        const R = sphereScreenR * 1.5;
        const cg = ctx.createRadialGradient(sphereCX, sphereCY, 0, sphereCX, sphereCY, R);
        cg.addColorStop(0, rgba("#5af0ff", 0.11 * brainFade));
        cg.addColorStop(0.42, rgba("#22d3ee", 0.04 * brainFade));
        cg.addColorStop(1, rgba("#22d3ee", 0));
        ctx.fillStyle = cg;
        ctx.fillRect(sphereCX - R, sphereCY - R, R * 2, R * 2);
      }

      // STAGE: globe connective edges (dormant) — NON-glowing (source-over) thin slate
      //        lines, faint, depth-faded. Just enough structure to web the nodes without
      //        a neon wireframe; the rough radial offsets give an organic silhouette.
      if (stage && brainFade > 0.01) {
        ctx.globalCompositeOperation = "source-over";
        ctx.lineWidth = 0.6 / k;
        const BUCKETS = 5;
        for (let b = 0; b < BUCKETS; b++) {
          const lo = b / BUCKETS, hi = (b + 1) / BUCKETS;
          ctx.strokeStyle = rgba("#6c828f", (0.04 + 0.12 * (lo + hi) / 2) * brainFade);
          ctx.beginPath();
          for (const [ia, ib] of brainEdges) {
            const s = nodes[ia], t = nodes[ib];
            if (s.x == null || t.x == null) continue;
            const ed = (depthOf(ia) + depthOf(ib)) / 2; // edge depth 0 (back) .. 1 (front)
            if (ed < lo || ed >= hi) continue;
            if (!inView(s.x, s.y) && !inView(t.x, t.y)) continue;
            ctx.moveTo(s.x!, s.y!); ctx.lineTo(t.x!, t.y!);
          }
          ctx.stroke();
        }
        ctx.globalCompositeOperation = "lighter"; // restore for the wikilink network below
      }

      // Real wikilink network — full strength in live; crossfades in on wake in stage.
      if (wikiFade > 0.01) {
        ctx.globalAlpha = wikiFade;
        // idle batch
        ctx.beginPath();
        ctx.strokeStyle = rgba(linkIdleC, 0.1 * waitDim); // idle links recede while answering (hit links stay)
        ctx.lineWidth = 0.6 / k;
        for (const l of links) {
          const s = l.source as GraphNode, t = l.target as GraphNode;
          if (s.x == null || t.x == null) continue;
          const sId = s.id, tId = t.id;
          if (litSet.has(sId) || litSet.has(tId)) continue;
          if (activeSet && (activeSet.has(sId) || activeSet.has(tId))) continue;
          if (!inView(s.x, s.y) && !inView(t.x, t.y)) continue;
          ctx.moveTo(s.x!, s.y!); ctx.lineTo(t.x!, t.y!);
        }
        ctx.stroke();
        // active + dim + hot
        for (const l of links) {
          const s = l.source as GraphNode, t = l.target as GraphNode;
          if (s.x == null || t.x == null) continue;
          if (!inView(s.x, s.y) && !inView(t.x, t.y)) continue;
          const sId = s.id, tId = t.id;
          const strongLit = (id: string) =>
            (litSet.get(id) ?? 0) > 0.02 && (intensity.current.get(id) ?? 1) >= 0.5;
          const hot = strongLit(sId) || strongLit(tId);
          const act = activeSet && activeSet.has(sId) && activeSet.has(tId);
          // a connected hub is drifting → shimmer this link brighter as it swings
          const dl = Math.max(driftLit.get(sId) ?? 0, driftLit.get(tId) ?? 0);
          if (hot) {
            // Per-link alpha eases DOWN as the brighter endpoint's link-count climbs, so a mega-hub's
            // hundreds of converging lit lines don't STACK (additive blend) into a blown-out white
            // disk. Normal lit nodes (few links) keep the full glow; base also dialled back a touch.
            // STAGE: this generic hub-fan scales with the live firing brightness (bright as a node
            // fires, then calms) so it reads as energy during the cascade but recedes at rest — the
            // crisp FIRED-PATHS circuit stays the hero, not a hazy starburst of every link.
            const lkMax = Math.max(litSet.get(sId) ?? 0, litSet.get(tId) ?? 0);
            const hotA = (stage ? 0.32 * lkMax : 0.55) * Math.min(1, 70 / Math.max(1, s.degree, t.degree));
            // Skip strokes too faint to see (raised on stage so a lit hub's broad fan of dim links
            // doesn't make the firing look busy — only the brighter, closer lines come through).
            if (hotA >= (stage ? 0.04 : 0.02)) {
              if (stage) {
                // Solid stroke — the gradient's endpoints were near-identical cyans here, so this reads
                // the same while skipping a createLinearGradient per hot link every frame.
                ctx.strokeStyle = rgba("#5fe6ff", hotA);
              } else {
                const g = ctx.createLinearGradient(s.x!, s.y!, t.x!, t.y!);
                g.addColorStop(0, rgba("#22d3ee", hotA)); g.addColorStop(1, rgba(litHaloC, hotA));
                ctx.strokeStyle = g;
              }
              ctx.lineWidth = (stage ? 0.6 + 0.6 * lkMax : 1.6) / k;
              ctx.beginPath(); ctx.moveTo(s.x!, s.y!); ctx.lineTo(t.x!, t.y!); ctx.stroke();
            }
          } else if (act) {
            ctx.strokeStyle = rgba(LINK_ACTIVE, 0.42); ctx.lineWidth = 1.1 / k;
            ctx.beginPath(); ctx.moveTo(s.x!, s.y!); ctx.lineTo(t.x!, t.y!); ctx.stroke();
          } else if (activeSet && (activeSet.has(sId) || activeSet.has(tId))) {
            ctx.strokeStyle = rgba(LINK_DIM, 0.04); ctx.lineWidth = 0.6 / k;
            ctx.beginPath(); ctx.moveTo(s.x!, s.y!); ctx.lineTo(t.x!, t.y!); ctx.stroke();
          } else if (dl > 0.08) {
            // Sparse, super-subtle shimmer: each hub pathway has its OWN slow twinkle, so only
            // the ~20% currently inside their lit window glow at once — a few paths drifting
            // across the hub web, never the whole brain. Faintly brighter when the hub moves.
            const tw = Math.sin(now * 0.0008 + (l._ph ?? 0));
            if (tw > 0.7) {
              const a2 = (tw - 0.7) / 0.3; // 0..1 inside the lit window
              ctx.strokeStyle = rgba(stage ? "#7fe9ff" : LINK_ACTIVE, (0.035 + 0.07 * a2) * (0.6 + 0.4 * dl));
              ctx.lineWidth = (0.5 + 0.4 * a2) / k;
              ctx.beginPath(); ctx.moveTo(s.x!, s.y!); ctx.lineTo(t.x!, t.y!); ctx.stroke();
            }
          }
        }
        ctx.globalAlpha = 1;
      }

      /* FIRED PATHS (stage) — every real wikilink an action-potential walked this query. Edges draw
         on as the cascade crosses them (no travelling dot — the line itself grows), then HOLD as a
         bright glowing circuit, so when the firing settles the whole network the neurons walked
         stays lit as one premium, high-tech web. Done edges are batched into a layered bloom (a few
         strokes total → hundreds stay cheap); the brightest, near-white core makes the pattern pop. */
      if (stage && firedEdges.size) {
        ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";
        const persist = 0.84 + 0.16 * Math.sin(now * 0.0016); // gentle breathing of the settled web
        // Pass A — every fully-walked edge, batched into a 3-layer bloom: wide soft halo → mid glow
        //          → hot near-white core. One stroke per layer however many edges there are.
        ctx.beginPath();
        let nDone = 0;
        for (const e of firedEdges.values()) {
          if (now - e.t0 < PHASE.pulseHop) continue; // still drawing → Pass B
          const s = idMap.get(e.a), t = idMap.get(e.b);
          if (!s || !t || s.x == null || t.x == null) continue;
          if (!inView(s.x, s.y) && !inView(t.x, t.y)) continue;
          ctx.moveTo(s.x!, s.y!); ctx.lineTo(t.x!, t.y!); nDone++;
        }
        if (nDone) {
          ctx.strokeStyle = rgba("#22d3ee", 0.17 * persist); ctx.lineWidth = 5.2 / k; ctx.stroke();
          ctx.strokeStyle = rgba("#5fe6ff", 0.42 * persist); ctx.lineWidth = 2.4 / k; ctx.stroke();
          ctx.strokeStyle = rgba("#dffbff", 0.9  * persist); ctx.lineWidth = 1.2 / k; ctx.stroke();
        }
        // Pass B — edges still being walked: draw on from the source to the leading point (NO dot),
        //          a touch brighter so the circuit visibly grows, then folds into Pass A's bloom.
        for (const e of firedEdges.values()) {
          const frac = (now - e.t0) / PHASE.pulseHop;
          if (frac < 0 || frac >= 1) continue;
          const s = idMap.get(e.a), t = idMap.get(e.b);
          if (!s || !t || s.x == null || t.x == null) continue;
          if (!inView(s.x, s.y) && !inView(t.x, t.y)) continue;
          const ee = easeInOutCubic(clamp01(frac));
          const ex = lerp(s.x!, t.x!, ee), ey = lerp(s.y!, t.y!, ee);
          ctx.strokeStyle = rgba("#7fe9ff", 0.5); ctx.lineWidth = 4.4 / k;
          ctx.beginPath(); ctx.moveTo(s.x!, s.y!); ctx.lineTo(ex, ey); ctx.stroke();
          ctx.strokeStyle = rgba("#eafdff", 0.95); ctx.lineWidth = 1.5 / k;
          ctx.beginPath(); ctx.moveTo(s.x!, s.y!); ctx.lineTo(ex, ey); ctx.stroke();
        }
      }

      /* READ-CIRCUIT — connect every read note into ONE glowing tree (nearest-neighbour MST), a dot
         travelling each link (the "connecting" signal). The lines GLOW while every other node + link
         is dimmed. Recomputed only when the set changes; positions tracked live. This is the path the
         answer was read along — it builds as notes land and holds until the next prompt. */
      const pSet = pathwaySetRef.current;
      if (pSet !== pathwayMstKeyRef.current) {
        pathwayMstKeyRef.current = pSet;
        pathwayMstRef.current = pSet.size >= 2 ? pathwayTree([...pSet], idMap) : [];
        // New prompt cleared the read-circuit → wipe the previous firing so the next query
        // traces a fresh path through the brain (the cascade state lives only for one query).
        if (stage && pSet.size === 0) {
          firedNodes.clear(); firedEdges.clear(); fireHop.clear(); fireClaimed.clear();
        }
      }
      // On stage the FIRED PATHS web (real walked wikilinks) IS the pattern — the straight-line MST
      // (and its travelling dot) would only clutter it, so it's live-only.
      const pTree = stage ? [] : pathwayMstRef.current;
      if (pTree.length) {
        ctx.globalCompositeOperation = "lighter";
        const pulse = reduced.current ? 0.85 : 0.74 + 0.26 * Math.sin(now * 0.0018);
        ctx.lineWidth = 1.25 / k;
        for (let ei = 0; ei < pTree.length; ei++) {
          const s = idMap.get(pTree[ei][0]), t = idMap.get(pTree[ei][1]);
          if (!s || !t || s.x == null || t.x == null) continue;
          if (!inView(s.x, s.y) && !inView(t.x, t.y)) continue;
          const g = ctx.createLinearGradient(s.x!, s.y!, t.x!, t.y!);
          g.addColorStop(0, rgba("#22d3ee", 0.42 * pulse));
          g.addColorStop(1, rgba("#7fe9ff", 0.42 * pulse));
          ctx.strokeStyle = g;
          ctx.beginPath(); ctx.moveTo(s.x!, s.y!); ctx.lineTo(t.x!, t.y!); ctx.stroke();
          if (!reduced.current) {
            const fr = (now * 0.0004 + ei * 0.37) % 1; // a dot travels the link (desynced per edge)
            const dx = lerp(s.x!, t.x!, fr), dy = lerp(s.y!, t.y!, fr);
            ctx.fillStyle = rgba("#d6fbff", 0.85 * pulse);
            ctx.beginPath(); ctx.arc(dx, dy, 1.6 / k, 0, Math.PI * 2); ctx.fill();
          }
        }
      }

      /* DUST */
      if (!reduced.current && dust.length) {
        for (const d of dust) {
          if (!inView(d.x, d.y)) continue;
          d.x += Math.sin(now * 0.0002 + d.phx) * 0.05;
          d.y += Math.cos(now * 0.0002 + d.phy) * 0.05;
          const tw = 0.05 + (0.5 + 0.5 * Math.sin(now * 0.001 + d.phx)) * 0.13;
          ctx.fillStyle = rgba(d.hue, tw);
          ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
        }
      }

      /* HALOS (additive) */
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (!inView(n.x, n.y)) continue;
        const rev = revealOf(i);
        if (rev <= 0.001) continue;
        const lk = litSet.get(n.id) ?? 0;
        const dim = activeSet ? !activeSet.has(n.id) : false;
        const baseHex = baseHexFor(n);
        // While thinking, tint each node's glow toward the active agent (keeps node identity).
        // On stage the lit/thinking tint goes cyan-white instead of the agent's violet.
        const tintHex = stage ? litHaloC : personaHex(persona);
        // Read-circuit notes keep a soft cyan (electric/neural) glow even after the firing fades, so
        // the path stays visible against the dimmed rest until the next prompt. On stage EVERY node
        // the cascade fired keeps that glow too → the whole walked network lingers as a lit circuit.
        const onPathSeed = pathway.has(n.id);                 // recalled/cited note — the key nodes
        const onFiredOnly = stage && !onPathSeed && firedNodes.has(n.id); // a cascade node
        const onPath = onPathSeed || onFiredOnly;
        // Final-pattern emphasis: seeds glow widest + brightest, cascade nodes a strong step below.
        const patternMul = onPathSeed ? 0.95 : onFiredOnly ? 0.55 : 0;
        const haloHex = lk > 0.01
          ? mixHex(baseHex, tintHex, 0.5)
          : onPath
            ? mixHex(baseHex, "#37d6ff", 0.5)
            : thinkActive
              ? mixHex(baseHex, tintHex, 0.3)
              : baseHex;
        const breathe = reduced.current ? 1 : 0.95 + 0.05 * Math.sin(now * 0.001 * BREATHE_RAD_PER_S + (n._phase ?? 0));
        let haloA = (haloFloor(n.degree) + lk * 0.5) * breathe;
        if (onPath) haloA += (onPathSeed ? 0.4 : 0.28) * breathe; // persistent glow marking the circuit
        if (dim) haloA *= 0.18;
        // Per-node thinking shimmer — desynced glow swell on each node.
        if (thinkActive && !dim && lk < 0.02) haloA += thinkRamp * (0.22 + 0.34 * thinkOsc(n._phase ?? 0));
        haloA *= rev;
        const dz = depthOf(i); // 1 off-stage; <1 = globe's far side
        haloA *= shadeBrightOf(i); // depth + key light + limb glow
        if (hitSet && !hitSet.has(n.id)) haloA *= waitDim; // recede non-hit nodes while answering
        if (haloA < 0.012) continue;
        const rm = rimMixOf(i); // limb/highlight → bright cyan-white
        const haloHexF = rm > 0.01 ? mixHex(haloHex, "#c8ffff", rm) : haloHex;
        const r = nodeRadius2D(n.val) * (1 + patternMul) * (0.62 + 0.38 * dz) * sphereSizeMul;
        const haloR = r * (3.2 + lk * 1.6 + rm * 1.7 + (thinkActive && lk < 0.02 ? thinkRamp * 1.0 : 0));
        ctx.globalAlpha = clamp01(haloA * sphereGlowMul);
        ctx.drawImage(getGlowSprite(haloHexF), n.x! - haloR, n.y! - haloR, haloR * 2, haloR * 2);
      }
      ctx.globalAlpha = 1;

      /* SHOCKWAVES — wobbled hand-inked rings for igniting cited nodes (≤~15) */
      if (!reduced.current) {
        for (const [id, start] of igniteAt.current) {
          // Seeds + cited (intensity 1) ring; spontaneous (0.33) never does, and on stage the many
          // cascade nodes (intensity <1) stay quiet so only the originating notes throw a shockwave.
          if ((intensity.current.get(id) ?? 1) < (stage ? 0.999 : 0.5)) continue;
          const age = now - start;
          for (const trail of [0, 90]) {
            const a2 = age - trail;
            if (a2 < PHASE.shockStart || a2 > PHASE.shockEnd) continue;
            const n = idMap.get(id);
            if (!n || !inView(n.x, n.y)) continue;
            const p = clamp01((a2 - PHASE.shockStart) / (PHASE.shockEnd - PHASE.shockStart));
            const r = nodeRadius2D(n.val);
            const ringR = lerp(r, r * 7, easeInOutCubic(p));
            const alpha = Math.pow(1 - p, 1.6) * 0.7 * (trail ? 0.5 : 1);
            ctx.strokeStyle = rgba(litHaloC, alpha);
            ctx.lineWidth = lerp(3, 0.4, p) / k;
            ctx.beginPath();
            for (let i = 0; i <= 48; i++) {
              const ang = (i / 48) * Math.PI * 2;
              const wob = ringR + Math.sin(ang * 5 + now * 0.002) * ringR * 0.04;
              const px = n.x! + Math.cos(ang) * wob, py = n.y! + Math.sin(ang) * wob;
              if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath(); ctx.stroke();
          }
        }
      }

      /* BEADS — action-potential pulses. They drive the cascade TIMING (land → ignite the next node
         so it fires onward); on stage the visible comet + trail are drawn by the FIRED PATHS pass
         above (kept in lock-step), so here stage only steps + lands. Live draws the little sprite. */
      if (!reduced.current) {
        const bead = getBeadSprite();
        for (const b of beads) {
          if (!b.active) continue;
          const p = clamp01((now - b.t0) / PHASE.pulseHop);
          if (p >= 1) {
            b.active = false;
            const t = idMap.get(b.tid);
            if (stage) {
              // Pulse landed → ignite this node so it fires its OWN pulses next frame (the chain
              // reaction). Intensity decays with depth but stays bright; silent (only seeds chime).
              if (t && t.x != null && !igniteAt.current.has(b.tid)) {
                const hop = b.depth;
                igniteAt.current.set(b.tid, now);
                intensity.current.set(b.tid, Math.max(0.6, 0.94 - hop * 0.07));
                fireHop.set(b.tid, hop);
                firedNodes.add(b.tid);
                firedSound.current.add(b.tid);
              }
            } else if (b.depth < 1 && t && !igniteAt.current.has(b.tid)) {
              // Live: original one-hop dim cascade (untouched).
              igniteAt.current.set(b.tid, now); intensity.current.set(b.tid, 0.4); firedSound.current.add(b.tid);
            }
            continue;
          }
          if (stage) continue; // visuals handled by the FIRED PATHS pass
          const e = easeInOutCubic(p);
          for (let s = 0; s < 3; s++) {
            const pp = Math.max(0, e - s * 0.06);
            const x = lerp(b.sx, b.tx, pp), y = lerp(b.sy, b.ty, pp);
            const bw = (6 - s * 1.5) / k * 2;
            ctx.globalAlpha = Math.min(0.7, (1 - s * 0.33) * (1 - p * 0.3));
            ctx.drawImage(bead, x - bw / 2, y - bw / 2, bw, bw);
          }
        }
        ctx.globalAlpha = 1;
      }

      /* CORES + RIM + SPIKE (source-over for cores) */
      ctx.globalCompositeOperation = "source-over";
      let labelCount = 0;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (!inView(n.x, n.y)) continue;
        const rev = revealOf(i);
        if (rev <= 0.001) continue;
        const a = getAnim(n.id);
        const lk = litSet.get(n.id) ?? 0;
        const fk = flashK.get(n.id) ?? 0;
        const isLit = lk > 0.02;
        const inActive = activeSet ? activeSet.has(n.id) : false;
        const dim = activeSet ? !inActive : false;
        const wd = hitSet && !hitSet.has(n.id) ? waitDim : 1; // recede non-hit nodes while answering

        a.targetAlpha = dim && !isLit ? 0.16 : 1;
        a.targetScale = inActive ? 1.3 : 1;
        a.alpha += (a.targetAlpha - a.alpha) * LERP;
        a.scale += (a.targetScale - a.scale) * LERP;

        const baseHex = baseHexFor(n);
        const dz = depthOf(i); // 1 off-stage; <1 shrinks/dims the globe's far side
        // Stage "final pattern" emphasis: nodes the cascade fired stay bigger + hotter than the rest,
        // with the originating recalled notes biggest — so the walked network reads as a deliberate,
        // highlighted constellation even after the firing flash has faded.
        const onPathN = pathway.has(n.id);
        const onFiredN = stage && firedNodes.has(n.id);
        const patternMul = onPathN ? 0.95 : onFiredN ? 0.55 : 0;
        const patternHeat = stage ? Math.max(lk, onPathN ? 0.62 : onFiredN ? 0.42 : 0) : lk;
        // Subtle per-node scale shimmer while thinking (synced to its glow oscillation).
        const thinkScale = thinkActive && !isLit ? thinkRamp * 0.12 * thinkOsc(n._phase ?? 0) : 0;
        const r = nodeRadius2D(n.val) * a.scale * (1 + fk * 0.9 + lk * 0.5 + thinkScale + patternMul) * (0.62 + 0.38 * dz) * sphereSizeMul;
        const rm = rimMixOf(i); // limb/highlight whitening on the globe

        // SPIKE (hub or lit), gated by zoom
        if (k >= LOD.addRim && (isLit || n.degree >= 6) && !(eProd(isProd) && !isLit)) {
          const spikeHex = isLit ? litHaloC : baseHex;
          const sp = r * (2 + lk * 1.4);
          ctx.globalCompositeOperation = "lighter";
          // base 0.25 unchanged (unlit hub look stays); only the LIT slope drops (peak 0.85 → 0.62).
          ctx.globalAlpha = clamp01(0.25 + lk * 0.37) * rev * wd;
          ctx.drawImage(getSpikeSprite(spikeHex), n.x! - sp, n.y! - sp, sp * 2, sp * 2);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
        }

        // CORE — lit + pattern nodes brighten toward a hot cyan-white, and pattern nodes KEEP that
        // heat after the flash so the walked constellation stays highlighted.
        const coreHex0 = (patternHeat > 0.02 || isLit) ? mixHex(baseHex, litCoreC, Math.min(0.85, patternHeat + fk)) : baseHex;
        const coreHex = rm > 0.01 ? mixHex(coreHex0, "#e6fbff", rm) : coreHex0;
        ctx.globalAlpha = clamp01(a.alpha * rev * shadeBrightOf(i) * wd);
        ctx.drawImage(getCoreSprite(coreHex), n.x! - r, n.y! - r, r * 2, r * 2);

        // RIM — a11y non-colour signal + highlight. Lit/active always; on stage every pattern node
        // gets a crisp cyan-white ring so the walked constellation reads as deliberately highlighted.
        if (k >= LOD.addRim || isLit || inActive || onFiredN) {
          if (!eProd(isProd) || isLit || inActive || onFiredN) {
            const ringStrong = isLit || onPathN;
            ctx.globalAlpha = a.alpha * rev * (ringStrong ? 1 : inActive ? 0.8 : onFiredN ? 0.72 : 0.45) * wd;
            ctx.strokeStyle = rgba(stage && (onFiredN || isLit) ? "#cdf7ff" : "#ffffff", ringStrong ? 0.92 : 0.55);
            ctx.lineWidth = (ringStrong ? 1.4 : 1) / k;
            ctx.beginPath(); ctx.arc(n.x!, n.y!, r + 0.6, 0, Math.PI * 2); ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;

        // LABEL — only on zoom-in or hover; cited/lit nodes do NOT auto-show their text.
        const labelZoom = clamp01((k - 1.5) / 1.5);
        const wantLabel = inActive || k >= LOD.addLabels;
        a.targetLabel = wantLabel ? 1 : labelZoom;
        a.label += (a.targetLabel - a.label) * LERP;
        if (a.label > 0.05 && labelCount < MAX_LABELS) {
          labelCount++;
          const fontSize = Math.max(3, Math.min(11, 12 / k));
          ctx.font = `500 ${fontSize}px var(--font-geist-sans, ui-sans-serif), system-ui`;
          ctx.textAlign = "center"; ctx.textBaseline = "top";
          if (isLit) { ctx.shadowColor = rgba("#0a0a0f", 0.9); ctx.shadowBlur = 3; }
          // Floor dimmed-label opacity so it stays legible on dark ground (WCAG).
          const labelAlpha = (dim && !isLit ? Math.max(0.5, a.label) : a.label) * rev;
          ctx.fillStyle = rgba(isLit ? "#ffffff" : inActive ? "#e4e4e7" : "#a8a8b0", labelAlpha);
          const label = n.name.length > 30 ? n.name.slice(0, 28) + "…" : n.name;
          ctx.fillText(label, n.x!, n.y! + r + 3);
          ctx.shadowBlur = 0;
        }
      }

      ctx.restore();
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    return () => {
      // Remember the settled layout so the next mount/resize doesn't re-scramble it.
      for (const n of nodes) if (n.x != null && n.y != null) posRef.current.set(n.id, { x: n.x, y: n.y });
      cancelAnimationFrame(raf);
      if (bgTimer) clearInterval(bgTimer);
      if (fitTimer) clearTimeout(fitTimer);
      sim.stop();
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("dblclick", onDblClick);
      canvas.removeEventListener("mousedown", onRightClick);
      canvas.removeEventListener("keydown", onKeyDown);
      sel.on(".zoom", null);
      // Wipe ignition state so stale node ids don't linger across data reloads.
      igniteAt.current.clear();
      intensity.current.clear();
      firedSound.current.clear();
      pulsed.current.clear();
    };
  }, [data, size.width, size.height, neighbors, setDragging, onNodeClick, stage]);

  const isEmpty = data !== null && data.nodes.length === 0;

  return (
    <div ref={containerRef} className="absolute inset-0">
      {(!data || size.width === 0) && !isEmpty && (
        <div className="flex h-full w-full items-center justify-center">
          <div className="text-center">
            <div className="text-sm text-zinc-500">Loading brain…</div>
          </div>
        </div>
      )}
      {isEmpty && (
        <div className="flex h-full w-full items-center justify-center">
          <div className="max-w-sm px-4 text-center">
            <div className="mb-1 text-sm font-medium text-zinc-300">No brain uploaded yet</div>
            <div className="text-xs leading-relaxed text-zinc-500">
              Open{" "}
              <span className="rounded bg-white/5 px-1 py-0.5 text-accent-300">
                Settings → Second brain
              </span>{" "}
              and upload a markdown vault to light up your knowledge graph.
            </div>
          </div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        tabIndex={0}
        aria-label="Second brain knowledge graph. Use arrow keys to move between notes, Enter to focus."
        className="absolute inset-0 select-none outline-none focus-visible:ring-2 focus-visible:ring-accent-400/60"
        style={{ display: isEmpty ? "none" : undefined }}
      />
      {/* Screen-reader mirror of the graph */}
      {data && (
        <ul className="sr-only">
          {data.nodes.map((n) => (
            <li key={n.id}>{n.name} — {n.folder}, {n.degree} links</li>
          ))}
        </ul>
      )}
      {hovered && data && <HoverTooltip nodeId={hovered} data={data} cited={highlights.includes(hovered)} />}
    </div>
  );
}

/* ---------- Hover tooltip --------------------------------------------------- */

function HoverTooltip({ nodeId, data, cited }: { nodeId: string; data: GraphData; cited: boolean }) {
  const node = data.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  return (
    <div
      className="glass pointer-events-none absolute left-1/2 top-16 z-30 -translate-x-1/2 px-3 py-2 text-xs"
      style={{ borderTop: `2px solid ${paletteHex(node.group)}` }}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium text-zinc-100">{node.name}</span>
        {cited && (
          <span className="rounded-full bg-accent-500/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-accent-300">
            cited
          </span>
        )}
      </div>
      <div className="mt-0.5 font-mono text-[10px] text-zinc-500">
        {node.folder} · {node.degree} link{node.degree === 1 ? "" : "s"}
      </div>
    </div>
  );
}

/* ---------- Helpers --------------------------------------------------------- */

function hashPhase(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (Math.abs(h % 1000) / 1000) * Math.PI * 2;
}
function eProd(isProd: boolean) {
  return isProd;
}
