// Calls the Claude API. Only use with access approved by your company.
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { z } from 'zod'

import type { ChatOptions, ChatResult } from './llm.js'

// Thrown when Claude's safety system declines a request. The caller decides
// what that means (the assistant hands over to a human; a judge records an error).
export class RefusalError extends Error {}

// Created on first use, so other modes never need credentials.
let client: Anthropic | undefined

export async function claudeChat<S extends z.ZodType>(
  opts: ChatOptions<S>,
): Promise<ChatResult<z.infer<S>>> {
  client ??= new Anthropic()

  // messages.parse() asks the API for JSON matching our zod schema
  // (structured outputs) and validates the response for us.
  // Current Claude models reject `temperature`, so only `effort` is sent.
  const response = await client.messages.parse({
    model: opts.model,
    max_tokens: 4000, // room for thinking + a short answer
    system: opts.system,
    messages: [{ role: 'user', content: opts.user }],
    output_config: { effort: opts.effort, format: zodOutputFormat(opts.schema) },
  })

  if (response.stop_reason === 'refusal') throw new RefusalError('Claude declined the request')
  if (response.parsed_output == null) {
    throw new Error(`Model did not return valid JSON (stop_reason: ${response.stop_reason})`)
  }
  return {
    output: response.parsed_output,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
}
