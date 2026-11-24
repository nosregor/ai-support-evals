// Central place for anything you might want to tweak between runs.
import 'dotenv/config'

// "offline" (default): a rule-based stand-in, no model needed.
// "ollama": a local model such as Llama, running in Ollama on this machine.
// "live": calls the Claude API. Only use this with access approved by your company.
const MODES = ['offline', 'ollama', 'live'] as const
export type LlmMode = (typeof MODES)[number]
export const LLM_MODE: LlmMode = MODES.find((m) => m === process.env.LLM_MODE) ?? 'offline'

export const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'

export const MODELS = {
  haiku: 'claude-haiku-5-5',
  sonnet: 'claude-sonnet-5-5',
  llama: process.env.OLLAMA_MODEL ?? 'llama3.1:8b',
} as const

// The model a variant uses by default in the current mode.
export const DEFAULT_MODEL = LLM_MODE === 'ollama' ? MODELS.llama : MODELS.haiku

// The judge should be at least as capable as the model it grades,
// otherwise it may miss subtle mistakes. With Ollama we only have Llama locally,
// so it grades itself: a known weakness worth discussing in the README.
export const JUDGE_MODEL = LLM_MODE === 'ollama' ? MODELS.llama : MODELS.sonnet

// A judge rating (1–5) counts as a pass at or above this value.
export const JUDGE_PASS_MIN = 4

// USD per 1M tokens, used for the cost estimate in the run summary.
// Check https://www.anthropic.com/pricing before relying on these numbers.
export const PRICING: Record<string, { input: number; output: number }> = {
  [MODELS.haiku]: { input: 0.1, output: 0.5 },
  [MODELS.sonnet]: { input: 2, output: 10 },
  [MODELS.llama]: { input: 0, output: 0 }, // runs locally
}

// Paths are relative to the repo root (where you run npm).
export const PATHS = {
  knowledgeBase: 'data/knowledge-base.md',
  golden: 'data/golden.json',
  results: 'results',
}
