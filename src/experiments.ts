// Named variants: each is one combination of prompt + model + settings.
// Run one with: npm run eval -- --variant <name>
import { MODEL } from './config.js'
import { promptV1 } from './prompts.js'
import type { Variant } from './types.js'

export const VARIANTS: Record<string, Variant> = {
  baseline: {
    name: 'baseline',
    model: MODEL,
    systemPrompt: promptV1,
    temperature: 0,
  },
}

export function getVariant(name: string): Variant {
  const variant = VARIANTS[name]
  if (!variant) {
    throw new Error(`Unknown variant "${name}". Available: ${Object.keys(VARIANTS).join(', ')}`)
  }
  return variant
}
