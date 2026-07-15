/** Shared shape consumed by the Synaptic Bloom graph renderer. */
export type GraphNode = {
  id: string;
  name: string;
  folder: string;
  val: number;
  group: number;
  tags: string[];
  degree: number;
};

export type GraphLink = { source: string; target: string };

export type BrainGraph = {
  nodes: GraphNode[];
  links: GraphLink[];
  folders: string[];
};
