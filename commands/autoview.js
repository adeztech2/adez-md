import { getSetting, setSetting } from '../lib/settings.js'
import { box } from '../lib/style.js'

export const name = 'autoview'
export const category = 'owner'
export const aliases = ['autostatus', 'viewstatus']
export const description = 'Automatically view contacts\' status updates (on / off)'

export async function run({ args, reply, isOwner, prefix }) {
  if (!isOwner) return reply('⛔ Owner only.')

  const opt = (args[0] || '').toLowerCase()
  if (!['on', 'off'].includes(opt)) {
    return reply(box('AUTO STATUS VIEW', [
      ['status', getSetting('autoview') === 'on' ? 'on' : 'off'],
      `${prefix}autoview on - view every status automatically`,
      `${prefix}autoview off - turn off`
    ]))
  }

  await setSetting('autoview', opt)
  return reply(box('AUTO STATUS VIEW', [['status', opt], opt === 'on' ? 'New statuses are now marked as viewed.' : 'Statuses will no longer be viewed automatically.']))
}
