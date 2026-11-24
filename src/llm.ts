// Talks to Llama running locally in Ollama (https://ollama.com).
// Both the assistant and the judges use this one function.
import { z } from 'zod'

import { OLLAMA_URL } from './config.js'

// Sends a system + user message and returns the model's JSON reply,
// validated against `schema`.
export async function askLlama<S extends z.ZodType>(opts: {
  model: string
  system: string
  user: string
  schema: S
  temperature: number
}): Promise<z.infer<S>> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    body: JSON.stringify({
      model: opts.model,
      stream: false,
      // Passing a JSON Schema makes Ollama force the reply into that shape.
      format: z.toJSONSchema(opts.schema),
      options: { temperature: opts.temperature },
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
    }),
  }).catch(() => {
    throw new Error(`Can't reach Ollama at ${OLLAMA_URL}. Run "ollama serve" first.`)
  })
  if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`)

  const data = (await res.json()) as { message: { content: string } }
  // Still validate: the reply can have the right shape but wrong values.
  return opts.schema.parse(JSON.parse(data.message.content))
}
