// Turns per-case results into a summary, and prints it.
import { PRICING } from './config.js'
import type { AssistantOutput, Category, Score } from './types.js'

export type CaseResult = {
  id: string
  category: Category
  input: string
  output?: AssistantOutput
  scores: Score[]
  pass: boolean // every scorer passed (and no error)
  latencyMs: number
  inputTokens: number
  outputTokens: number
  error?: string
}

export type Summary = {
  cases: number
  passed: number
  passRate: number
  byCategory: Record<string, { cases: number; passed: number; passRate: number }>
  byScorer: Record<string, { runs: number; avgScore: number; passRate: number }>
  avgLatencyMs: number
  totalInputTokens: number
  totalOutputTokens: number
  estimatedCostUsd: number
}

const rate = (passed: number, total: number) => (total ? passed / total : 0)
const pct = (n: number) => `${(n * 100).toFixed(0)}%`.padStart(5)

export function summarize(results: CaseResult[], model: string): Summary {
  const byCategory: Summary['byCategory'] = {}
  const scorerTotals: Record<string, { runs: number; total: number; passed: number }> = {}

  for (const r of results) {
    const cat = (byCategory[r.category] ??= { cases: 0, passed: 0, passRate: 0 })
    cat.cases++
    if (r.pass) cat.passed++
    for (const s of r.scores) {
      const t = (scorerTotals[s.name] ??= { runs: 0, total: 0, passed: 0 })
      t.runs++
      t.total += s.score
      if (s.pass) t.passed++
    }
  }
  for (const cat of Object.values(byCategory)) cat.passRate = rate(cat.passed, cat.cases)

  const byScorer: Summary['byScorer'] = {}
  for (const [name, t] of Object.entries(scorerTotals)) {
    byScorer[name] = { runs: t.runs, avgScore: t.total / t.runs, passRate: rate(t.passed, t.runs) }
  }

  const passed = results.filter((r) => r.pass).length
  const totalInputTokens = results.reduce((n, r) => n + r.inputTokens, 0)
  const totalOutputTokens = results.reduce((n, r) => n + r.outputTokens, 0)
  const price = PRICING[model] ?? { input: 0, output: 0 }

  return {
    cases: results.length,
    passed,
    passRate: rate(passed, results.length),
    byCategory,
    byScorer,
    avgLatencyMs: Math.round(results.reduce((n, r) => n + r.latencyMs, 0) / (results.length || 1)),
    totalInputTokens,
    totalOutputTokens,
    estimatedCostUsd: (totalInputTokens * price.input + totalOutputTokens * price.output) / 1e6,
  }
}

export function printCase(r: CaseResult) {
  console.log(`${r.pass ? '✅' : '❌'} ${r.id}  "${r.input}"`)
  if (r.error) console.log(`   error: ${r.error}`)
  if (r.output) console.log(`   reply: ${r.output.reply}  [escalate=${r.output.escalate}]`)
  for (const s of r.scores) {
    console.log(`   ${s.pass ? '✓' : '✗'} ${s.name.padEnd(20)} ${s.score.toFixed(2)}  ${s.reason}`)
  }
  console.log()
}

export function printSummary(s: Summary, results: CaseResult[]) {
  console.log(`\nOverall: ${s.passed}/${s.cases} cases passed (${pct(s.passRate).trim()})\n`)

  console.log('Category        Pass rate')
  for (const [name, c] of Object.entries(s.byCategory)) {
    console.log(`${name.padEnd(15)} ${pct(c.passRate)}  (${c.passed}/${c.cases})`)
  }

  console.log('\nScorer                Avg score  Pass rate')
  for (const [name, sc] of Object.entries(s.byScorer)) {
    console.log(`${name.padEnd(21)} ${sc.avgScore.toFixed(2).padStart(9)}  ${pct(sc.passRate)}`)
  }

  console.log(
    `\nAvg latency ${s.avgLatencyMs} ms · tokens ${s.totalInputTokens} in / ${s.totalOutputTokens} out` +
      ` · est. assistant cost $${s.estimatedCostUsd.toFixed(4)} (judge calls not included)`,
  )

  const failed = results.filter((r) => !r.pass)
  if (failed.length) {
    console.log(`\nFailed cases (${failed.length}):`)
    for (const r of failed) {
      const reasons = r.error
        ? [`error: ${r.error}`]
        : r.scores.filter((sc) => !sc.pass).map((sc) => `${sc.name}: ${sc.reason}`)
      console.log(`  ${r.id}\n    - ${reasons.join('\n    - ')}`)
    }
  }
}
