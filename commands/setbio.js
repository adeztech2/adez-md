import { box } from '../lib/style.js'

export const name = 'setbio'
export const category = 'owner'
export const description = 'Change the bot About text'

export async function run({ sock, args, prefix, isOwner, reply }) {
  if (!isOwner) return reply(box('SETBIO', ['⛔ Only the owner can use this.']))

  const text = args.join(' ').trim()
  if (!text) return reply(box('SETBIO', [['usage', `${prefix}setbio <text>`]]))

  try {
    await sock.updateProfileStatus(text)
    await reply(box('SETBIO', [['status', 'About updated ✅']]))
  } catch (e) {
    console.log('Setbio failed:', e.message)
    await reply(box('SETBIO', ['Could not change the About text.']))
  }
}
