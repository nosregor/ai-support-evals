import { z } from "zod";

// What the assistant model must return. Asking for JSON makes `escalate`
// explicit, so we can score it with plain code instead of guessing from text.
export const AssistantOutputSchema = z.object({
  reply: z.string().describe("The message shown to the customer."),
  escalate: z
    .boolean()
    .describe("True if a human agent should take over this conversation."),
});
export type AssistantOutput = z.infer<typeof AssistantOutputSchema>;

// What answer() returns: the model output plus measurements for the eval.
export type AssistantResult = AssistantOutput & {
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
};

// A variant is one combination of prompt + model settings we want to compare.
// `temperature` is used by Ollama; current Claude models reject it and use
// `effort` (how much the model thinks) instead.
export type Effort = "low" | "medium" | "high";
export type Variant = {
  name: string;
  model: string;
  systemPrompt: (knowledgeBase: string) => string;
  effort: Effort;
  temperature: number;
};
