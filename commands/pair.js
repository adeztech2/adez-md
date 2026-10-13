import { box, botName } from '../lib/style.js'

export const name = 'pair'
export const category = 'general'
export const aliases = ['getsession']
export const description = 'Link a WhatsApp number to the bot'

const PAIR_URL = 'https://arnoldadezbot.onrender.com/pair.html'

export async function run({ args, prefix, reply }) {
  const title = `${botName()} PAIR`
  const number = args.join('').replace(/\D/g, '')

  if (!number) {
    return reply(box(title, [
      ['usage', `${prefix}pair 2547xxxxxxxx`],
      ['or page', PAIR_URL]
    ]))
  }

  const start = globalThis.__adez?.startPairing
  if (!start) return reply(box(title, ['Pairing is not available right now.']))

  try {
    await reply(box(title, [['number', `+${number}`], ['status', 'Getting your code... ⏳']]))
    const code = await start(number)
    await reply(box(title, [
      ['code', code],
      'WhatsApp > Linked devices > Link with phone number',
      'Type the code within 3 minutes ⏱️'
    ]))
  } catch (e) {
    console.log('Pair command failed:', e.message)
    await reply(box(title, [e.message]))
  }
}
