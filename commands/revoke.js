import { box } from '../lib/style.js'
import { groupGuard } from '../lib/guard.js'

export const name = 'revoke'
export const category = 'group'
export const aliases = ['resetlink']
export const description = 'Reset the group invite link'

export async function run(ctx) {
  const { sock, from, reply } = ctx
  const error = groupGuard('REVOKE', ctx)
  if (error) return reply(error)

  try {
    const code = await sock.groupRevokeInvite(from)
    await reply(box('REVOKE', [['status', 'Old link is dead ✅'], `https://chat.whatsapp.com/${code}`]))
  } catch (e) {
    console.log('Revoke failed:', e.message)
    await reply(box('REVOKE', ['Could not reset the link.']))
  }
}
