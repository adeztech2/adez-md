import { getSetting, setSetting } from '../lib/settings.js'
import { box } from '../lib/style.js'

export const name = 'antilink'
export const category = 'group'
export const aliases = []
export const description = 'Delete links sent by members (on / kick / off)'

export async function run({ args, reply, isGroup, isAdmin, isBotAdmin, isOwner, from, prefix }) {
  if (!isGroup) return reply('This command works in groups only.')
  if (!isAdmin && !isOwner) return reply('⛔ Admins only.')

  let map = {}
  try { map = JSON.parse(getSetting('antilink') || '{}') } catch {}

  const opt = (args[0] || '').toLowerCase()
  if (!['on', 'kick', 'off'].includes(opt)) {
    return reply(
      box('ANTI-LINK', [
        ['this group', map[from] || 'off'],
        `${prefix}antilink on - delete links and warn`,
        `${prefix}antilink kick - delete and remove sender`,
        `${prefix}antilink off - turn off`
      ])
    )
  }

  if (opt === 'off') delete map[from]
  else map[from] = opt
  await setSetting('antilink', JSON.stringify(map))

  const rows = [['this group', opt]]
  if (opt !== 'off' && !isBotAdmin) rows.push('⚠️ Make the bot an admin or this cannot work')
  return reply(box('ANTI-LINK', rows))
}
