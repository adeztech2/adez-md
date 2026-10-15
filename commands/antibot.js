import { getSetting, setSetting } from '../lib/settings.js'
import { box } from '../lib/style.js'

export const name = 'antibot'
export const category = 'group'
export const aliases = []
export const description = 'Remove other bots from the group (on / off)'

export async function run({ args, reply, isGroup, isAdmin, isBotAdmin, isOwner, from, prefix }) {
  if (!isGroup) return reply('This command works in groups only.')
  if (!isAdmin && !isOwner) return reply('⛔ Admins only.')

  let map = {}
  try { map = JSON.parse(getSetting('antibot') || '{}') } catch {}

  const opt = (args[0] || '').toLowerCase()
  if (!['on', 'off'].includes(opt)) {
    return reply(
      box('ANTI-BOT', [
        ['this group', map[from] || 'off'],
        `${prefix}antibot on - remove other bots`,
        `${prefix}antibot off - turn off`
      ])
    )
  }

  if (opt === 'off') delete map[from]
  else map[from] = opt
  await setSetting('antibot', JSON.stringify(map))

  const rows = [['this group', opt]]
  if (opt !== 'off' && !isBotAdmin) rows.push('⚠️ Make the bot an admin or this cannot work')
  return reply(box('ANTI-BOT', rows))
}
