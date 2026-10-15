import { randomInt } from 'crypto'
import { box } from '../lib/style.js'

export const name = 'dice'
export const category = 'fun'
export const aliases = ['roll']
export const description = 'Roll dice: .dice  |  .dice 2d20'

export async function run({ args, reply, prefix }) {
  const input = (args[0] || '1d6').toLowerCase()
  const match = /^(\d{1,2})d(\d{1,3})$/.exec(input)
  if (!match) return reply(box('DICE', [`Use: ${prefix}dice  or  ${prefix}dice 2d20 (2 dice with 20 sides)`]))
  const count = parseInt(match[1], 10)
  const sides = parseInt(match[2], 10)
  if (count < 1 || count > 10 || sides < 2) return reply(box('DICE', ['Use 1 to 10 dice, each with 2 or more sides.']))
  const rolls = Array.from({ length: count }, () => randomInt(1, sides + 1))
  const rows = [['dice', `${count}d${sides}`], ['rolls', rolls.join(', ')]]
  if (count > 1) rows.push(['total', rolls.reduce((a, b) => a + b, 0)])
  return reply(box('DICE 🎲', rows))
}
