type JsonSchema = Record<string, unknown>;

type OpenAIJsonOptions = {
  name: string;
  schema: JsonSchema;
  instructions: string;
  input: unknown;
  maxOutputTokens?: number;
  signal?: AbortSignal;
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
};

function responseText(data: OpenAIResponse): string {
  return data.output_text || data.output
    ?.flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text || "")
    .join("\n") || "";
}

async function createResponse(body: Record<string, unknown>, signal?: AbortSignal): Promise<OpenAIResponse> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("Add OPENAI_API_KEY to .env.local, then restart the local server.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.6-sol",
      reasoning: { effort: "medium" },
      ...body,
      instructions: `${NO_EMDASH_RULE}\n\n${String(body.instructions || "")}`,
    }),
    signal,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${detail.slice(0, 320)}`);
  }
  return response.json() as Promise<OpenAIResponse>;
}

export async function openAIText(options: Omit<OpenAIJsonOptions, "name" | "schema">): Promise<string> {
  const data = await createResponse({
    instructions: options.instructions,
    input: options.input,
    max_output_tokens: options.maxOutputTokens || 4096,
  }, options.signal);
  const text = responseText(data).trim();
  if (!text) throw new Error("OpenAI returned an empty response.");
  return stripEmDashes(text);
}

export async function openAIJson<T>(options: OpenAIJsonOptions): Promise<T> {
  const data = await createResponse({
    instructions: options.instructions,
    input: options.input,
    max_output_tokens: options.maxOutputTokens || 4096,
    text: {
      format: {
        type: "json_schema",
        name: options.name,
        strict: true,
        schema: options.schema,
      },
    },
  }, options.signal);
  const text = responseText(data).trim();
  if (!text) throw new Error("OpenAI returned an empty structured response.");
  try {
    return stripEmDashesDeep(JSON.parse(text) as T);
  } catch {
    throw new Error("OpenAI returned invalid structured JSON.");
  }
}
import { NO_EMDASH_RULE, stripEmDashes, stripEmDashesDeep } from "./sanitize";
