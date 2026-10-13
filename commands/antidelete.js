import { getSetting, setSetting } from '../lib/settings.js'
import { box } from '../lib/style.js'

export const name = 'antidelete'
export const category = 'owner'
export const aliases = []
export const description = 'Recover deleted messages (on / chat / off)'

export async function run({ args, reply, isOwner, prefix }) {
  if (!isOwner) return reply('⛔ Owner only.')
  const opt = (args[0] || '').toLowerCase()
  if (!['on', 'chat', 'off'].includes(opt)) {
    return reply(
      box('ANTI-DELETE', [
        ['status', getSetting('antidelete') || 'off'],
        `${prefix}antidelete on - send to your own chat`,
        `${prefix}antidelete chat - repost in the same chat`,
        `${prefix}antidelete off - turn off`
      ])
    )
  }
  await setSetting('antidelete', opt)
  return reply(box('ANTI-DELETE', [['status', opt]]))
}
