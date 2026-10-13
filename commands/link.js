import { box } from '../lib/style.js'
import { groupGuard } from '../lib/guard.js'

export const name = 'link'
export const category = 'group'
export const aliases = ['invite', 'grouplink']
export const description = 'Get the group invite link'

export async function run(ctx) {
  const { sock, from, reply } = ctx
  const error = groupGuard('LINK', ctx)
  if (error) return reply(error)

  try {
    const code = await sock.groupInviteCode(from)
    await reply(box('LINK', [`https://chat.whatsapp.com/${code}`]))
  } catch (e) {
    console.log('Link failed:', e.message)
    await reply(box('LINK', ['Could not get the link.']))
  }
}
