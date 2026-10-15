import { randomInt } from 'crypto'
import { box } from '../lib/style.js'

export const name = 'password'
export const category = 'tools'
export const aliases = ['pass']
export const description = 'Make a strong password: .password 16'

export async function run({ args, reply }) {
  const len = Math.min(64, Math.max(8, parseInt(args[0], 10) || 16))
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*?'
  let pw = ''
  for (let i = 0; i < len; i++) pw += chars[randomInt(chars.length)]
  return reply(box('PASSWORD', [['length', len], ['password', '```' + pw + '```'], 'Use this in a private chat only.']))
}
