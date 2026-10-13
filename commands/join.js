import { box } from '../lib/style.js'

export const name = 'join'
export const category = 'owner'
export const description = 'Join a group using an invite link'

export async function run({ sock, args, prefix, isOwner, reply }) {
  if (!isOwner) return reply(box('JOIN', ['⛔ Only the owner can use this.']))

  const match = args.join(' ').match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/)
  if (!match) return reply(box('JOIN', [['usage', `${prefix}join <group link>`]]))

  try {
    await sock.groupAcceptInvite(match[1])
    await reply(box('JOIN', [['status', 'Joined ✅']]))
  } catch (e) {
    console.log('Join failed:', e.message)
    await reply(box('JOIN', ['Could not join. The link may be old or the group full.']))
  }
}
