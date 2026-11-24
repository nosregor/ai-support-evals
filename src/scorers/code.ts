// Deterministic checks: plain code, no model involved. They are free, fast and
// never change their mind, so use them for everything that can be checked this way.
// The LLM judge only covers what code can't (is it correct? helpful? polite?).
import type { AssistantOutput, GoldenCase, Score } from '../types.js'

const MAX_WORDS = 150

export function escalationCorrect(c: GoldenCase, out: AssistantOutput): Score {
  const pass = out.escalate === c.shouldEscalate
  return {
    name: 'escalationCorrect',
    score: pass ? 1 : 0,
    pass,
    reason: pass
      ? `escalate=${out.escalate} as expected`
      : `expected escalate=${c.shouldEscalate}, got ${out.escalate}`,
  }
}

// A mustInclude entry is either one phrase or a list of acceptable alternatives.
export const alternatives = (entry: string | string[]) => (Array.isArray(entry) ? entry : [entry])

export const includesEntry = (text: string, entry: string | string[]) =>
  alternatives(entry).some((alt) => text.toLowerCase().includes(alt.toLowerCase()))

export function containsRequired(c: GoldenCase, out: AssistantOutput): Score {
  const required = c.mustInclude ?? []
  const missing = required
    .filter((entry) => !includesEntry(out.reply, entry))
    .map((entry) => alternatives(entry).join(' / '))
  // Partial credit, so "2 of 3 facts" scores better than "none".
  const score = required.length ? (required.length - missing.length) / required.length : 1
  return {
    name: 'containsRequired',
    score,
    pass: missing.length === 0,
    reason: missing.length ? `missing: ${missing.join(', ')}` : 'all required phrases present',
  }
}

export function avoidsForbidden(c: GoldenCase, out: AssistantOutput): Score {
  const reply = out.reply.toLowerCase()
  const found = (c.mustNotInclude ?? []).filter((s) => reply.includes(s.toLowerCase()))
  return {
    name: 'avoidsForbidden',
    score: found.length ? 0 : 1,
    pass: found.length === 0,
    reason: found.length ? `contains forbidden: ${found.join(', ')}` : 'no forbidden phrases',
  }
}

export function lengthOk(_c: GoldenCase, out: AssistantOutput): Score {
  const words = out.reply.trim().split(/\s+/).filter(Boolean).length
  const pass = words <= MAX_WORDS
  return {
    name: 'lengthOk',
    score: pass ? 1 : 0,
    pass,
    reason: `${words} words (limit ${MAX_WORDS})`,
  }
}

// Only run checks that apply: a case with no mustInclude has nothing to check,
// and counting it as a free pass would inflate the pass rate.
export function codeScores(c: GoldenCase, out: AssistantOutput): Score[] {
  const scores = [escalationCorrect(c, out), lengthOk(c, out)]
  if (c.mustInclude?.length) scores.push(containsRequired(c, out))
  if (c.mustNotInclude?.length) scores.push(avoidsForbidden(c, out))
  return scores
}
