// Turns per-case results into a summary, and prints it.
import type { AssistantOutput, Category, Score } from './types.js'

export type CaseResult = {
  id: string
  category: Category
  input: string
  output?: AssistantOutput
  scores: Score[]
  pass: boolean // every scorer passed (and no error)
  latencyMs: number
  error?: string
}

type Tally = { total: number; passed: number; scoreSum: number }

const pct = (passed: number, total: number) => `${Math.round((passed / total) * 100)}%`.padStart(5)

export function summarize(results: CaseResult[]) {
  // Pass rate per category: how many test cases passed in each group.
  const byCategory: Record<string, Tally> = {}
  for (const r of results) {
    const t = (byCategory[r.category] ??= { total: 0, passed: 0, scoreSum: 0 })
    t.total++
    if (r.pass) t.passed++
  }

  // Per scorer: how often it passed and its average score, across all cases.
  const byScorer: Record<string, Tally> = {}
  for (const s of results.flatMap((r) => r.scores)) {
    const t = (byScorer[s.name] ??= { total: 0, passed: 0, scoreSum: 0 })
    t.total++
    if (s.pass) t.passed++
    t.scoreSum += s.score
  }

  return {
    cases: results.length,
    passed: results.filter((r) => r.pass).length,
    byCategory,
    byScorer,
    avgLatencyMs: Math.round(results.reduce((n, r) => n + r.latencyMs, 0) / results.length),
  }
}
export type Summary = ReturnType<typeof summarize>

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
  console.log(`\nOverall: ${s.passed}/${s.cases} cases passed (${pct(s.passed, s.cases).trim()})\n`)

  console.log('Category        Pass rate')
  for (const [name, t] of Object.entries(s.byCategory)) {
    console.log(`${name.padEnd(15)} ${pct(t.passed, t.total)}  (${t.passed}/${t.total})`)
  }

  console.log('\nScorer                Avg score  Pass rate')
  for (const [name, t] of Object.entries(s.byScorer)) {
    const avg = (t.scoreSum / t.total).toFixed(2).padStart(9)
    console.log(`${name.padEnd(21)} ${avg}  ${pct(t.passed, t.total)}`)
  }
  console.log(`\nAverage answer time: ${s.avgLatencyMs} ms`)

  const failed = results.filter((r) => !r.pass)
  if (failed.length) console.log(`\nFailed cases (${failed.length}):`)
  for (const r of failed) {
    const reasons = r.error
      ? [`error: ${r.error}`]
      : r.scores.filter((sc) => !sc.pass).map((sc) => `${sc.name}: ${sc.reason}`)
    console.log(`  ${r.id}\n    - ${reasons.join('\n    - ')}`)
  }
}
