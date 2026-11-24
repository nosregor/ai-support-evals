import { readFileSync } from 'node:fs'
import { z } from 'zod'

import { knowledgeBase } from './assistant.js'
import { PATHS } from './config.js'
import { alternatives, includesEntry } from './scorers/code.js'
import { GoldenCaseSchema, type GoldenCase } from './types.js'

// Validating the dataset up front turns a typo in golden.json into a clear
// error, instead of a confusing failure halfway through a run.
export function loadGolden(path = PATHS.golden): GoldenCase[] {
  const cases = z.array(GoldenCaseSchema).parse(JSON.parse(readFileSync(path, 'utf8')))
  const problems: string[] = []
  const ids = new Set<string>()

  for (const c of cases) {
    if (ids.has(c.id)) problems.push(`${c.id}: duplicate id`)
    ids.add(c.id)

    // The knowledge base is the single source of truth. If a required fact is
    // not in it (e.g. someone changed "14 days" to "30 days" in the KB but not
    // here), the eval would punish the assistant for being correct.
    for (const entry of c.mustInclude ?? []) {
      if (!includesEntry(knowledgeBase, entry)) {
        problems.push(`${c.id}: "${alternatives(entry).join(' / ')}" is not in the knowledge base`)
      }
    }
  }

  if (problems.length) throw new Error(`Invalid dataset ${path}:\n  ${problems.join('\n  ')}`)
  return cases
}
