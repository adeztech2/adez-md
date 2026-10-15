import { box } from '../lib/style.js'
import { getSetting, setSetting } from '../lib/settings.js'

export const name = 'antibot'
export const category = 'group'
export const description = 'Delete messages from other bots: .antibot on/off'

export async function run({ from, args, isGroup, isAdmin, isOwner, isBotAdmin, reply, prefix }) {
  if (!isGroup) return reply(box('ANTIBOT', ['This command works in groups only.']))
  if (!isAdmin && !isOwner) return reply(box('ANTIBOT', ['Only group admins can change this.']))

  const choice = (args[0] || '').toLowerCase()
  const key = `antibot_${from}`
  if (choice !== 'on' && choice !== 'off') {
    return reply(box('ANTIBOT', [
      ['status', getSetting(key) === 'on' ? 'ON ✅' : 'OFF ❌'],
      `Use: ${prefix}antibot on  or  ${prefix}antibot off`
    ]))
  }
  await setSetting(key, choice)
  const rows = [['status', choice === 'on' ? 'ON ✅' : 'OFF ❌']]
  if (choice === 'on' && !isBotAdmin) rows.push('Make me a group admin so I can delete messages.')
  return reply(box('ANTIBOT', rows))
}
