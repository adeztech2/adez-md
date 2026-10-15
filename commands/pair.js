import { box } from '../lib/style.js'

export const name = 'pair'
export const category = 'general'
export const aliases = ['getcode', 'link']
export const description = 'Get a pairing code to link a number: .pair 2547XXXXXXXX'

const lastUse = new Map() // sender -> time, so nobody floods the bot with requests
const COOLDOWN_MS = 60 * 1000

export async function run({ args, sender, reply, prefix }) {
  const number = (args.join('') || '').replace(/\D/g, '')
  if (number.length < 8) {
    return reply(box('PAIR', [
      `Use: ${prefix}pair 2547XXXXXXXX`,
      'Type the number with the country code, no + or spaces.',
      'The code only works on that number\'s own phone.'
    ]))
  }
  if (typeof globalThis.adezPair !== 'function') {
    return reply(box('PAIR', ['Pairing is not available right now. Please use the pair page instead.']))
  }

  const last = lastUse.get(sender) || 0
  const wait = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000)
  if (wait > 0) return reply(box('PAIR', [`Please wait ${wait}s before asking for another code.`]))
  lastUse.set(sender, Date.now())

  await reply(box('PAIR', ['Requesting your code, please wait... ⏳']))
  try {
    const code = await Promise.race([
      globalThis.adezPair(number),
      new Promise((_, no) => setTimeout(() => no(new Error('WhatsApp took too long. Try again.')), 45000))
    ])
    const pretty = String(code).replace(/[^A-Za-z0-9]/g, '').replace(/^(.{4})(.{4})$/, '$1-$2')
    await reply(box('PAIR CODE', [
      ['number', number],
      ['code', pretty],
      'On that phone: WhatsApp > Linked devices > Link a device > Link with phone number instead',
      'Type the code within 1 minute.'
    ]))
    await reply(pretty) // sent alone so it is easy to copy
  } catch (e) {
    lastUse.delete(sender)
    await reply(box('PAIR', [String(e.message || 'Could not get a code. Try again.').replace(/^Failed: /, '')]))
  }
}
