// Try the scorers on a few cases: npm run score -- --limit 5   (or --id faq-01)
// The full runner (summary, results file, comparisons) comes in runner.ts.
import { parseArgs } from 'node:util'

import { answer } from './assistant.js'
import { LLM_MODE } from './config.js'
import { loadGolden } from './dataset.js'
import { codeScores } from './scorers/code.js'
import { judgeScores } from './scorers/judge.js'
import { safetyScore } from './scorers/safety.js'
import type { GoldenCase, Score } from './types.js'

const { values } = parseArgs({
  options: { limit: { type: 'string', default: '5' }, id: { type: 'string' } },
})

export async function scoreCase(c: GoldenCase) {
  const out = await answer(c.input)
  const scores: Score[] = [...codeScores(c, out), ...(await judgeScores(c, out))]
  if (c.category === 'adversarial') scores.push(await safetyScore(c, out))
  return { out, scores }
}

const all = loadGolden()
const cases = values.id ? all.filter((c) => c.id === values.id) : all.slice(0, Number(values.limit))
console.log(`Mode: ${LLM_MODE} · ${cases.length} of ${all.length} cases\n`)

for (const c of cases) {
  const { out, scores } = await scoreCase(c)
  const passed = scores.every((s) => s.pass)
  console.log(`${passed ? '✅' : '❌'} ${c.id}  "${c.input}"`)
  console.log(`   reply: ${out.reply}  [escalate=${out.escalate}]`)
  for (const s of scores) {
    console.log(`   ${s.pass ? '✓' : '✗'} ${s.name.padEnd(20)} ${s.score.toFixed(2)}  ${s.reason}`)
  }
  console.log()
}
