/** A prompt-level rule backed by the deterministic functions below. */
export const NO_EMDASH_RULE =
  "ABSOLUTE OUTPUT RULE: never use an em dash (—), en dash (–), figure dash (‒), or horizontal bar (―). Use a comma, period, colon, parentheses, or the word 'to' for ranges. This applies to every title, label, sentence, caption, CTA, and any text intended to appear inside an image.";

/** Remove the common AI dash tell while preserving ordinary hyphen-minus characters. */
export function stripEmDashes(input: string): string {
  if (!input) return input;
  return input
    .replace(/\s*[—―]\s*/g, ", ")
    .replace(/(\S)\s+[‒–]\s+(\S)/g, "$1, $2")
    .replace(/([0-9])\s*[‒–]\s*([0-9])/g, "$1 to $2")
    .replace(/[‒–]/g, "-")
    .replace(/−/g, "-")
    .replace(/ +,/g, ",")
    .replace(/,(?:\s*,)+/g, ",")
    .replace(/,\s*([.!?;:])/g, "$1")
    .replace(/(^|\n)[ \t]*,[ \t]*/g, "$1");
}

/** Recursively sanitize every string in a structured model response. */
export function stripEmDashesDeep<T>(value: T): T {
  if (typeof value === "string") return stripEmDashes(value) as T;
  if (Array.isArray(value)) return value.map(stripEmDashesDeep) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, stripEmDashesDeep(item)])
    ) as T;
  }
  return value;
}
