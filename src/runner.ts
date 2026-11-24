// The eval: run every test case through the assistant, score each answer,
// print a summary and save the results.
//   npm run eval -- [--variant baseline] [--category faq] [--limit 5] [--id faq-02] [--verbose]
import { mkdirSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

import { answer } from './assistant.js'
import { JUDGE_MODEL, PATHS } from './config.js'
import { loadGolden } from './dataset.js'
import { getVariant } from './experiments.js'
import { printCase, printSummary, summarize, type CaseResult } from './report.js'
import { codeScores } from './scorers/code.js'
import { judgeScores } from './scorers/judge.js'
import { safetyScore } from './scorers/safety.js'
import type { GoldenCase, Score, Variant } from './types.js'

const { values: args } = parseArgs({
  options: {
    variant: { type: 'string', default: 'baseline' },
    category: { type: 'string' },
    limit: { type: 'string' },
    id: { type: 'string' },
    verbose: { type: 'boolean', default: false },
  },
})

// One test case: get the answer, then run every scorer that applies.
async function runCase(c: GoldenCase, variant: Variant): Promise<CaseResult> {
  const base = { id: c.id, category: c.category, input: c.input }
  try {
    const { latencyMs, ...output } = await answer(c.input, variant)
    const scores: Score[] = [...codeScores(c, output), ...(await judgeScores(c, output))]
    if (c.category === 'adversarial') scores.push(await safetyScore(c, output))
    return { ...base, output, scores, pass: scores.every((s) => s.pass), latencyMs }
  } catch (err) {
    // Record the error and carry on, so one broken case doesn't stop the run.
    const error = err instanceof Error ? err.message : String(err)
    return { ...base, scores: [], pass: false, latencyMs: 0, error }
  }
}

// 1. Pick the variant and the test cases.
const variant = getVariant(args.variant)
let cases = loadGolden()
if (args.category) cases = cases.filter((c) => c.category === args.category)
if (args.id) cases = cases.filter((c) => c.id === args.id)
if (args.limit) cases = cases.slice(0, Number(args.limit))
if (!cases.length) throw new Error('No cases match those filters')

console.log(`Variant: ${variant.name} · model: ${variant.model} · judge: ${JUDGE_MODEL}`)
console.log(`Running ${cases.length} cases...\n`)

// 2. Run them one by one.
const results: CaseResult[] = []
for (const c of cases) {
  const result = await runCase(c, variant)
  results.push(result)
  if (args.verbose) printCase(result)
  else process.stdout.write(`\r${results.length}/${cases.length} cases scored`)
}

// 3. Summarise.
const summary = summarize(results)
printSummary(summary, results)

// 4. Save, so this run can be inspected or compared later.
const runAt = new Date().toISOString()
const file = `${PATHS.results}/${runAt.replace(/[:.]/g, '-')}_${variant.name}.json`
mkdirSync(PATHS.results, { recursive: true })
// JSON.stringify skips the variant's systemPrompt function.
writeFileSync(
  file,
  JSON.stringify({ runAt, variant, judgeModel: JUDGE_MODEL, summary, results }, null, 2),
)
console.log(`\nResults saved to ${file}`)
