// Named variants: each is one combination of prompt + model + settings.
// Run one with: npm run eval -- --variant <name>
import { DEFAULT_MODEL } from './config.js'
import { promptV1 } from './prompts.js'
import type { Variant } from './types.js'

export const VARIANTS: Record<string, Variant> = {
  baseline: {
    name: 'baseline',
    model: DEFAULT_MODEL,
    systemPrompt: promptV1,
    effort: 'low',
    temperature: 0, // as repeatable as possible, so runs are comparable
  },
}

export function getVariant(name: string): Variant {
  const variant = VARIANTS[name]
  if (!variant) {
    throw new Error(`Unknown variant "${name}". Available: ${Object.keys(VARIANTS).join(', ')}`)
  }
  return variant
}
