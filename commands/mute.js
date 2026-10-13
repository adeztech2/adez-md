import { box } from '../lib/style.js'
import { groupGuard } from '../lib/guard.js'

export const name = 'mute'
export const category = 'group'
export const aliases = ['unmute', 'close', 'open']
export const description = 'Mute or unmute the group'

export async function run(ctx) {
  const { sock, from, command, reply } = ctx
  const error = groupGuard('GROUP', ctx)
  if (error) return reply(error)

  const opening = ['unmute', 'open'].includes(command)
  try {
    await sock.groupSettingUpdate(from, opening ? 'not_announcement' : 'announcement')
    await reply(box('GROUP', [['status', opening ? 'Unmuted 🔓 Everyone can send' : 'Muted 🔒 Admins only']]))
  } catch (e) {
    console.log('Mute failed:', e.message)
    await reply(box('GROUP', ['Could not change the group setting.']))
  }
}
