// One function for "ask a model, get validated JSON back", whichever model it is.
// The assistant and the LLM judges both go through here.
import type { z } from 'zod'

import { LLM_MODE } from '../config.js'
import type { Effort } from '../types.js'
import { claudeChat } from './claude.js'
import { ollamaChat } from './ollama.js'

export type ChatOptions<S extends z.ZodType> = {
  model: string
  system: string
  user: string
  schema: S
  temperature: number // used by Ollama
  effort: Effort // used by Claude
}

export type ChatResult<T> = { output: T; inputTokens: number; outputTokens: number }

export async function structuredChat<S extends z.ZodType>(
  opts: ChatOptions<S>,
): Promise<ChatResult<z.infer<S>>> {
  if (LLM_MODE === 'ollama') return ollamaChat(opts)
  if (LLM_MODE === 'live') return claudeChat(opts)
  throw new Error('structuredChat() needs a model; offline mode uses the rule-based stand-ins')
}
