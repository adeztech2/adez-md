import { getSetting, setSetting } from '../lib/settings.js'
import { box } from '../lib/style.js'

export const name = 'anticall'
export const category = 'owner'
export const aliases = []
export const description = 'Reject calls automatically (on / block / off)'

export async function run({ args, reply, isOwner, prefix }) {
  if (!isOwner) return reply('⛔ Owner only.')
  const opt = (args[0] || '').toLowerCase()
  if (!['on', 'block', 'off'].includes(opt)) {
    return reply(
      box('ANTI-CALL', [
        ['status', getSetting('anticall') || 'off'],
        `${prefix}anticall on - reject calls`,
        `${prefix}anticall block - reject and block`,
        `${prefix}anticall off - allow calls`
      ])
    )
  }
  await setSetting('anticall', opt)
  return reply(box('ANTI-CALL', [['status', opt]]))
}
