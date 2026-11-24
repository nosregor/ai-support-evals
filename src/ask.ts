// Quick manual test of the assistant: npm run ask "How long does installation take?"
import { answer } from './assistant.js'
import { getVariant } from './experiments.js'

const message = process.argv.slice(2).join(' ') || 'How long does installation take?'
const result = await answer(message, getVariant('baseline'))
console.log(JSON.stringify(result, null, 2))
