import { readFileSync } from 'node:fs'

import { DEFAULT_MODEL, LLM_MODE, PATHS } from './config.js'
import { mockAnswer } from './offline/mock-assistant.js'
import { promptV1 } from './prompts.js'
import { RefusalError } from './providers/claude.js'
import { structuredChat } from './providers/llm.js'
import { AssistantOutputSchema, type AssistantResult, type Variant } from './types.js'

// The whole knowledge base fits in the prompt, so we skip retrieval (RAG) entirely.
// That keeps the project focused on evaluation rather than search quality.
export const knowledgeBase = readFileSync(PATHS.knowledgeBase, 'utf8')

export const defaultVariant: Variant = {
  name: 'baseline',
  model: DEFAULT_MODEL,
  systemPrompt: promptV1,
  effort: 'low',
  temperature: 0, // as repeatable as possible, so runs are comparable
}

// Same signature in every mode, so the rest of the pipeline never needs to know
// which model (or stand-in) produced the answer.
export async function answer(
  message: string,
  variant: Variant = defaultVariant,
): Promise<AssistantResult> {
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

  try {
    const { output, inputTokens, outputTokens } = await structuredChat({
      model: variant.model,
      system: variant.systemPrompt(knowledgeBase),
      user: message,
      schema: AssistantOutputSchema,
      temperature: variant.temperature,
      effort: variant.effort,
    })
    return { ...output, latencyMs: elapsed(), inputTokens, outputTokens }
  } catch (err) {
    if (!(err instanceof RefusalError)) throw err
    // Treat a safety refusal as "hand over to a human".
    return {
      reply: "I'm sorry, I can't help with that. Let me connect you with a colleague.",
      escalate: true,
      latencyMs: elapsed(),
      inputTokens: 0,
      outputTokens: 0,
    }
  }
}
