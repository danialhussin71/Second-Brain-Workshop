/**
 * Slash commands for the command bar. A command pins the request to ONE content
 * producer, so the CEO planner never has to guess the format from wording.
 * Shared by the client (autocomplete menu) and the run route (routing).
 */

export type SlashFormat = "text" | "picture" | "carousel" | "reels" | "longform" | "newsletter";

export type SlashCommand = {
  /** canonical name, typed as `/name` */
  name: string;
  aliases: string[];
  format: SlashFormat;
  label: string;
  description: string;
  /** example argument shown in the menu */
  example: string;
  /** Phosphor icon name, resolved on the client */
  icon: "Article" | "Image" | "Cards" | "VideoCamera" | "FilmSlate" | "EnvelopeSimple";
  /** how the producer brief opens */
  verb: string;
};

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: "carousel", aliases: ["deck", "slides"], format: "carousel", label: "Carousel", description: "Swipe-through deck with on-brand slide images", example: "7 slides on why founders need a second brain", icon: "Cards", verb: "Create a carousel" },
  { name: "image", aliases: ["picture", "img"], format: "picture", label: "Image post", description: "Single on-brand image with caption", example: "the moment I stopped trading time for money", icon: "Image", verb: "Create a single-image post" },
  { name: "text", aliases: ["post"], format: "text", label: "Text post", description: "LinkedIn / X post in your voice", example: "a contrarian take on cold outreach", icon: "Article", verb: "Write a text post" },
  { name: "reel", aliases: ["reels", "short"], format: "reels", label: "Reel script", description: "Short-form video script (15-90s)", example: "30 seconds on my morning system", icon: "VideoCamera", verb: "Write a short-form reel script" },
  { name: "video", aliases: ["script", "longform", "youtube"], format: "longform", label: "Video script", description: "Long-form video script with chapters", example: "10 minutes on building an offer", icon: "FilmSlate", verb: "Write a long-form video script" },
  { name: "newsletter", aliases: ["email"], format: "newsletter", label: "Newsletter", description: "HTML email newsletter issue", example: "what I learned launching this month", icon: "EnvelopeSimple", verb: "Write an email newsletter" },
];

export function findSlashCommand(name: string): SlashCommand | undefined {
  const key = name.toLowerCase();
  return SLASH_COMMANDS.find((command) => command.name === key || command.aliases.includes(key));
}

/** Commands whose name or alias starts with the typed prefix (without the slash). */
export function matchSlashCommands(prefix: string): SlashCommand[] {
  const key = prefix.toLowerCase();
  return SLASH_COMMANDS.filter((command) => command.name.startsWith(key) || command.aliases.some((alias) => alias.startsWith(key)));
}

export type ParsedSlash = { command: SlashCommand; topic: string };

/** Parse `/name rest…`. Returns null for plain text or an unknown command. */
export function parseSlashCommand(input: string): ParsedSlash | null {
  const match = input.trim().match(/^\/([a-z-]+)(?:\s+([\s\S]*))?$/i);
  if (!match) return null;
  const command = findSlashCommand(match[1]);
  return command ? { command, topic: (match[2] || "").trim() } : null;
}

/** The brief handed to the producer. An empty topic lets the brain pick one. */
export function slashInstruction({ command, topic }: ParsedSlash): string {
  return topic
    ? `${command.verb}. Brief: ${topic}`
    : `${command.verb} on the strongest, most on-brand topic you can find in my second brain.`;
}
