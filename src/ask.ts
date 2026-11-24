// Quick manual test of the assistant: npm run ask "How long does installation take?"
import { answer } from './assistant.js'

const message = process.argv.slice(2).join(' ') || 'How long does installation take?'
const result = await answer(message)
console.log(JSON.stringify(result, null, 2))
