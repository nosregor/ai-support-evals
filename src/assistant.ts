import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { DEFAULT_MODEL, LLM_MODE, PATHS } from "./config.js";
import { mockAnswer } from "./offline/mock-assistant.js";
import { promptV1 } from "./prompts.js";
import { ollamaChat } from "./providers/ollama.js";
import {
  AssistantOutputSchema,
  type AssistantOutput,
  type AssistantResult,
  type Variant,
} from "./types.js";

// The whole knowledge base fits in the prompt, so we skip retrieval (RAG) entirely.
// That keeps the project focused on evaluation rather than search quality.
const knowledgeBase = readFileSync(PATHS.knowledgeBase, "utf8");

export const defaultVariant: Variant = {
  name: "baseline",
  model: DEFAULT_MODEL,
  systemPrompt: promptV1,
  effort: "low",
  temperature: 0, // as repeatable as possible, so runs are comparable
};

// Same signature in every mode, so the rest of the pipeline never needs to know
// which model (or stand-in) produced the answer.
export async function answer(
  message: string,
  variant: Variant = defaultVariant,
): Promise<AssistantResult> {
  if (LLM_MODE === "ollama") return answerOllama(message, variant);
  if (LLM_MODE === "live") return answerLive(message, variant);
  return answerOffline(message, variant);
}

async function answerOllama(message: string, variant: Variant): Promise<AssistantResult> {
  const start = performance.now();
  const { output, inputTokens, outputTokens } = await ollamaChat({
    model: variant.model,
    system: variant.systemPrompt(knowledgeBase),
    user: message,
    schema: AssistantOutputSchema,
    temperature: variant.temperature,
  });
  return { ...output, latencyMs: Math.round(performance.now() - start), inputTokens, outputTokens };
}

async function answerOffline(message: string, variant: Variant): Promise<AssistantResult> {
  const start = performance.now();
  const output = mockAnswer(message);
  return {
    ...output,
    latencyMs: Math.round(performance.now() - start),
    // Rough estimate (~4 characters per token) so cost reports have something to show.
    inputTokens: Math.ceil((variant.systemPrompt(knowledgeBase).length + message.length) / 4),
    outputTokens: Math.ceil(output.reply.length / 4),
  };
}

// Created on first use, so offline mode never needs credentials.
let client: Anthropic | undefined;

async function answerLive(message: string, variant: Variant): Promise<AssistantResult> {
  client ??= new Anthropic();
  const start = performance.now();

  // messages.parse() asks the API for JSON matching our zod schema
  // (structured outputs) and validates the response for us.
  const response = await client.messages.parse({
    model: variant.model,
    max_tokens: 4000, // room for thinking + a short reply
    system: variant.systemPrompt(knowledgeBase),
    messages: [{ role: "user", content: message }],
    output_config: {
      effort: variant.effort,
      format: zodOutputFormat(AssistantOutputSchema),
    },
  });

  let output: AssistantOutput;
  if (response.stop_reason === "refusal") {
    // Treat a safety refusal as "hand over to a human".
    output = { reply: "I'm sorry, I can't help with that. Let me connect you with a colleague.", escalate: true };
  } else if (response.parsed_output) {
    output = response.parsed_output;
  } else {
    throw new Error(`Model did not return valid JSON (stop_reason: ${response.stop_reason})`);
  }

  return {
    ...output,
    latencyMs: Math.round(performance.now() - start),
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
