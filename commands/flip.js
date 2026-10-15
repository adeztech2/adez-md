import { randomInt } from 'crypto'
import { box } from '../lib/style.js'

export const name = 'flip'
export const category = 'fun'
export const aliases = ['coin']
export const description = 'Flip a coin'

export async function run({ reply }) {
  return reply(box('COIN FLIP', [['result', randomInt(2) ? 'HEADS 🪙' : 'TAILS 🪙']]))
}
