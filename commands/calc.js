import { box } from '../lib/style.js'

export const name = 'calc'
export const category = 'tools'
export const aliases = ['calculate', 'math']
export const description = 'Calculate a math expression'

export async function run({ args, prefix, reply }) {
  const expr = args.join(' ').trim()
  if (!expr) return reply(box('CALC', [['usage', `${prefix}calc 12*5+3`]]))

  // Only numbers and math symbols are allowed
  if (!/^[0-9+\-*/().%\s]+$/.test(expr)) {
    return reply(box('CALC', ['Use only numbers and + - * / ( ) %']))
  }

  try {
    const result = Function(`"use strict"; return (${expr})`)()
    if (!Number.isFinite(result)) throw new Error('bad result')
    await reply(box('CALC', [['sum', expr], ['answer', result]]))
  } catch {
    await reply(box('CALC', ['That is not a valid calculation.']))
  }
}
