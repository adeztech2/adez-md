import { getSetting, setSetting } from '../lib/settings.js'
import { box } from '../lib/style.js'

export const name = 'chatbot'
export const category = 'owner'
export const aliases = []
export const description = 'Let the bot reply to messages with AI (on / off)'

export async function run({ args, reply, isOwner, prefix }) {
  if (!isOwner) return reply('⛔ Owner only.')
  const opt = (args[0] || '').toLowerCase()
  if (!['on', 'off'].includes(opt)) {
    return reply(
      box('CHATBOT', [
        ['status', getSetting('chatbot') || 'off'],
        `${prefix}chatbot on - reply to people with AI`,
        `${prefix}chatbot off - turn off`,
        'Private chats: replies to every message',
        'Groups: replies only when someone tags or replies to the bot'
      ])
    )
  }
  await setSetting('chatbot', opt)
  return reply(box('CHATBOT', [['status', opt]]))
}
