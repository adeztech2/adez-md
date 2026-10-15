import { randomInt } from 'crypto'
import { box } from '../lib/style.js'

export const name = '8ball'
export const category = 'fun'
export const aliases = ['ask']
export const description = 'Ask the magic 8 ball: .8ball will I pass?'

const ANSWERS = [
  'Yes, definitely 🎱', 'It is certain', 'Without a doubt', 'Most likely yes', 'Signs point to yes',
  'Ask again later', 'Cannot predict now', 'Better not tell you now',
  "Don't count on it", 'My answer is no', 'Very doubtful', 'Outlook not so good'
]

export async function run({ args, reply, prefix }) {
  const q = args.join(' ').trim()
  if (!q) return reply(box('8 BALL', [`Ask a question: ${prefix}8ball will I pass my exam?`]))
  return reply(box('8 BALL', [['question', q], ['answer', ANSWERS[randomInt(ANSWERS.length)]]]))
}
