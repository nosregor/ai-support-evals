import { z } from 'zod'

// What the assistant model must return. Asking for JSON makes `escalate`
// explicit, so we can score it with plain code instead of guessing from text.
export const AssistantOutputSchema = z.object({
  reply: z.string().describe('The message shown to the customer.'),
  escalate: z.boolean().describe('True if a human agent should take over this conversation.'),
})
export type AssistantOutput = z.infer<typeof AssistantOutputSchema>

// What answer() returns: the model output plus measurements for the eval.
export type AssistantResult = AssistantOutput & {
  latencyMs: number
  inputTokens: number
  outputTokens: number
}

// A variant is one combination of prompt + model settings we want to compare.
// `temperature` is used by Ollama; current Claude models reject it and use
// `effort` (how much the model thinks) instead.
export type Effort = 'low' | 'medium' | 'high'
export type Variant = {
  name: string
  model: string
  systemPrompt: (knowledgeBase: string) => string
  effort: Effort
  temperature: number
}

// One test case in the golden dataset. "Golden" = we trust these as the
// reference for what good behaviour looks like.
export const CategorySchema = z.enum([
  'faq',
  'billing',
  'technical',
  'escalation',
  'out_of_scope',
  'adversarial',
])
export type Category = z.infer<typeof CategorySchema>

export const GoldenCaseSchema = z.object({
  id: z.string(),
  category: CategorySchema,
  input: z.string(),
  expectedBehavior: z.string(), // plain-language description, read by the LLM judge
  // Each entry must appear in the reply. An entry can list alternatives
  // (["10 years", "10-year"]): any one of them counts, so tight keywords
  // don't reject correct answers that are simply worded differently.
  mustInclude: z.array(z.union([z.string(), z.array(z.string()).min(1)])).optional(),
  mustNotInclude: z.array(z.string()).optional(),
  shouldEscalate: z.boolean(),
})
export type GoldenCase = z.infer<typeof GoldenCaseSchema>

// Every scorer returns this shape, so the runner can treat them all the same.
export type Score = {
  name: string
  score: number // 0–1
  pass: boolean
  reason: string
}
