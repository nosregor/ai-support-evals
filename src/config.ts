// Settings you might want to tweak. Override any of them in .env.
import 'dotenv/config'

export const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'

// The model that answers customers.
export const MODEL = process.env.OLLAMA_MODEL ?? 'llama3.1:8b'

// The model that grades the answers. Ideally stronger than MODEL: a model
// grading its own answers tends to be too generous.
export const JUDGE_MODEL = process.env.OLLAMA_JUDGE_MODEL ?? MODEL

// A judge rating (1–5) counts as a pass at or above this value.
export const JUDGE_PASS_MIN = 4

export const PATHS = {
  knowledgeBase: 'data/knowledge-base.md',
  golden: 'data/golden.json',
  results: 'results',
}
