// Runs the golden dataset through the assistant and all scorers, then saves and
// prints the results.
//   npm run eval -- [--variant baseline] [--category faq] [--limit 5] [--id faq-02] [--verbose]
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

import { answer } from './assistant.js'
import { JUDGE_MODEL, LLM_MODE, PATHS } from './config.js'
import { loadGolden } from './dataset.js'
import { getVariant } from './experiments.js'
import { printCase, printSummary, summarize, type CaseResult } from './report.js'
import { codeScores } from './scorers/code.js'
import { judgeScores } from './scorers/judge.js'
import { safetyScore } from './scorers/safety.js'
import { CategorySchema, type GoldenCase, type Score, type Variant } from './types.js'

const BATCH_SIZE = 3
const MAX_ATTEMPTS = 3

const { values: args } = parseArgs({
  options: {
    variant: { type: 'string', default: 'baseline' },
    category: { type: 'string' },
    limit: { type: 'string' },
    id: { type: 'string' },
    verbose: { type: 'boolean', default: false },
  },
})

// Retries with exponential backoff (1s, 2s, ...): model calls fail now and then
// (timeouts, rate limits), and one flaky call shouldn't fail a whole case.
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS) throw err
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (attempt - 1)))
    }
  }
}

async function runCase(c: GoldenCase, variant: Variant): Promise<CaseResult> {
  const base = { id: c.id, category: c.category, input: c.input }
  try {
    const out = await withRetry(() => answer(c.input, variant))
    const scores: Score[] = [...codeScores(c, out), ...(await withRetry(() => judgeScores(c, out)))]
    if (c.category === 'adversarial') scores.push(await withRetry(() => safetyScore(c, out)))
    const { latencyMs, inputTokens, outputTokens, ...output } = out
    return {
      ...base,
      output,
      scores,
      pass: scores.every((s) => s.pass),
      latencyMs,
      inputTokens,
      outputTokens,
    }
  } catch (err) {
    // Record the failure and keep going, so one broken case doesn't stop the run.
    const error = err instanceof Error ? err.message : String(err)
    return {
      ...base,
      scores: [],
      pass: false,
      latencyMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      error,
    }
  }
}

const variant = getVariant(args.variant)
let cases = loadGolden()
if (args.category) cases = cases.filter((c) => c.category === CategorySchema.parse(args.category))
if (args.id) cases = cases.filter((c) => c.id === args.id)
if (args.limit) cases = cases.slice(0, Number(args.limit))
if (!cases.length) throw new Error('No cases match those filters')

console.log(
  `Mode: ${LLM_MODE} · variant: ${variant.name} (${LLM_MODE === 'offline' ? 'rule-based' : variant.model})` +
    ` · ${cases.length} cases\n`,
)

// Run cases in small batches: faster than one at a time, without overloading the model.
const results: CaseResult[] = []
for (let i = 0; i < cases.length; i += BATCH_SIZE) {
  const batch = cases.slice(i, i + BATCH_SIZE)
  for (const result of await Promise.all(batch.map((c) => runCase(c, variant)))) {
    results.push(result)
    if (args.verbose) printCase(result)
  }
  if (!args.verbose) process.stdout.write(`\r${results.length}/${cases.length} cases scored`)
}

const summary = summarize(results, variant.model)
printSummary(summary, results)

// Save everything needed to inspect or compare this run later.
const runAt = new Date().toISOString()
const file = join(PATHS.results, `${runAt.replace(/[:.]/g, '-')}_${variant.name}.json`)
mkdirSync(PATHS.results, { recursive: true })
const config = {
  runAt,
  mode: LLM_MODE,
  variant, // JSON.stringify skips the systemPrompt function
  judgeModel: LLM_MODE === 'offline' ? 'rule-based' : JUDGE_MODEL,
  filters: { category: args.category, limit: args.limit, id: args.id },
}
writeFileSync(file, JSON.stringify({ config, summary, results }, null, 2))
console.log(`\nResults saved to ${file}`)
