// The thing we are evaluating: a support assistant that answers from the FAQ.
import { readFileSync } from 'node:fs'

import { PATHS } from './config.js'
import { askLlama } from './llm.js'
import { AssistantOutputSchema, type AssistantResult, type Variant } from './types.js'

// The whole FAQ fits in the prompt, so there is no search step (RAG).
// That keeps the project focused on evaluation.
export const knowledgeBase = readFileSync(PATHS.knowledgeBase, 'utf8')

export async function answer(message: string, variant: Variant): Promise<AssistantResult> {
  const start = performance.now()
  const output = await askLlama({
    model: variant.model,
    system: variant.systemPrompt(knowledgeBase),
    user: message,
    schema: AssistantOutputSchema,
    temperature: variant.temperature,
  })
  return { ...output, latencyMs: Math.round(performance.now() - start) }
}
