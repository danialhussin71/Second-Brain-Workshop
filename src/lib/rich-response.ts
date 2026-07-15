import type { Block } from "@/components/blocks/parse";

export const RICH_BLOCK_TYPES = [
  "text", "callout", "keypoints", "actions", "stats", "quote", "chips", "idea",
  "timeline", "steps", "decision", "people", "kpi", "meter", "bars", "define", "table",
] as const;

export type RichBlockJson = {
  type: (typeof RICH_BLOCK_TYPES)[number];
  text: string;
  title: string;
  body: string;
  variant: string;
  accent: string;
  attribution: string;
  term: string;
};

export type RichResponse = {
  title: string;
  summary: string;
  blocks: RichBlockJson[];
  citations: string[];
};

export const RICH_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "blocks", "citations"],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    citations: { type: "array", items: { type: "string" } },
    blocks: {
      type: "array",
      minItems: 2,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "text", "title", "body", "variant", "accent", "attribution", "term"],
        properties: {
          type: { type: "string", enum: RICH_BLOCK_TYPES },
          text: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
          variant: { type: "string" },
          accent: { type: "string" },
          attribution: { type: "string" },
          term: { type: "string" },
        },
      },
    },
  },
} as const;

export function toUiBlock(block: RichBlockJson): Block {
  switch (block.type) {
    case "text": return { type: "text", text: block.text || block.body };
    case "callout": return { type: "callout", variant: block.variant || "insight", body: block.body };
    case "keypoints": return { type: "keypoints", body: block.body };
    case "actions": return { type: "actions", body: block.body };
    case "stats": return { type: "stats", body: block.body };
    case "quote": return { type: "quote", attr: block.attribution, body: block.body };
    case "chips": return { type: "chips", title: block.title, body: block.body };
    case "idea": return { type: "idea", body: block.body };
    case "timeline": return { type: "timeline", title: block.title, body: block.body };
    case "steps": return { type: "steps", title: block.title, body: block.body };
    case "decision": return { type: "decision", title: block.title, body: block.body };
    case "people": return { type: "people", title: block.title, body: block.body };
    case "kpi": return { type: "kpi", accent: block.accent || "cyan", body: block.body };
    case "meter": return { type: "meter", title: block.title, body: block.body };
    case "bars": return { type: "bars", title: block.title, body: block.body };
    case "define": return { type: "define", term: block.term || block.title, body: block.body };
    case "table": return { type: "table", title: block.title, body: block.body };
  }
}
