import { readFileSync } from 'node:fs'

import { LLM_MODE, PATHS } from './config.js'
import { mockAnswer } from './offline/mock-assistant.js'
import { structuredChat } from './providers/llm.js'
import { AssistantOutputSchema, type AssistantResult, type Variant } from './types.js'

// The whole knowledge base fits in the prompt, so we skip retrieval (RAG) entirely.
// That keeps the project focused on evaluation rather than search quality.
export const knowledgeBase = readFileSync(PATHS.knowledgeBase, 'utf8')

// Same signature in every mode, so the rest of the pipeline never needs to know
// which model (or stand-in) produced the answer.
export async function answer(message: string, variant: Variant): Promise<AssistantResult> {
  const start = performance.now()
  const elapsed = () => Math.round(performance.now() - start)

  if (LLM_MODE === 'offline') {
    const output = mockAnswer(message)
    return {
      ...output,
      latencyMs: elapsed(),
      // Rough estimate (~4 characters per token) so cost reports have something to show.
      inputTokens: Math.ceil((variant.systemPrompt(knowledgeBase).length + message.length) / 4),
      outputTokens: Math.ceil(output.reply.length / 4),
    }
  }

  const { output, inputTokens, outputTokens } = await structuredChat({
    model: variant.model,
    system: variant.systemPrompt(knowledgeBase),
    user: message,
    schema: AssistantOutputSchema,
    temperature: variant.temperature,
    effort: variant.effort,
  })
  return { ...output, latencyMs: elapsed(), inputTokens, outputTokens }
}
