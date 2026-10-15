import { getSetting, setSetting } from '../lib/settings.js'

export const name = 'chatbot'
export const category = 'owner'
export const aliases = []
export const description = 'Turn the AI chatbot on or off (on / off)'

export async function run({ args, reply, isOwner, prefix }) {
  if (!isOwner) return reply('Owner only.')

  const opt = (args[0] || '').toLowerCase()
  const current = getSetting('chatbot') === 'on' ? 'on' : 'off'

  if (!['on', 'off'].includes(opt)) {
    return reply(
      `Chatbot is ${current}.\n\n${prefix}chatbot on - answer normal messages with AI\n${prefix}chatbot off - turn off`
    )
  }

  await setSetting('chatbot', opt)
  return reply(`Chatbot is now ${opt}.`)
}
