// Calls a model running locally in Ollama (https://ollama.com), e.g. Llama.
// Nothing leaves your machine and there is no API key or per-token cost.
import { z } from "zod";

import { OLLAMA_URL } from "../config.js";

type ChatResult<T> = { output: T; inputTokens: number; outputTokens: number };

// Ollama's /api/chat response; we only validate the fields we use.
const OllamaResponseSchema = z.object({
  message: z.object({ content: z.string() }),
  prompt_eval_count: z.number().default(0),
  eval_count: z.number().default(0),
});

export async function ollamaChat<T>(opts: {
  model: string;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  temperature: number;
}): Promise<ChatResult<T>> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    signal: AbortSignal.timeout(120_000),
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model,
      stream: false,
      // Passing a JSON Schema makes Ollama constrain the output to that shape.
      format: z.toJSONSchema(opts.schema),
      options: { temperature: opts.temperature },
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
  }).catch((err: unknown) => {
    throw new Error(`Can't reach Ollama at ${OLLAMA_URL}. Is the Ollama app running?`, { cause: err });
  });
  if (!res.ok) {
    throw new Error(`Ollama error ${res.status}: ${await res.text()} (is "ollama serve" running?)`);
  }

  const data = OllamaResponseSchema.parse(await res.json());
  // The format constraint makes valid JSON very likely, but we still validate:
  // small local models can produce the right shape with the wrong content types.
  const output = opts.schema.parse(JSON.parse(data.message.content));
  return { output, inputTokens: data.prompt_eval_count, outputTokens: data.eval_count };
}
