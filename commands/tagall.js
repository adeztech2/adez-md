import { box } from '../lib/style.js'

export const name = 'tagall'
export const category = 'group'
export const aliases = ['everyone']
export const description = 'Mention every group member'

export async function run({ sock, from, m, args, isGroup, isAdmin, isOwner, groupMetadata, reply }) {
  if (!isGroup) return reply(box('TAGALL', ['This works in groups only.']))
  if (!isAdmin && !isOwner) return reply(box('TAGALL', ['⛔ Admins only.']))

  const members = groupMetadata?.participants || []
  const ids = members.map((p) => p.id)
  const list = ids.map((id) => `➽ @${id.split('@')[0]}`).join('\n')
  const note = args.join(' ').trim() || 'Attention everyone!'

  await sock.sendMessage(
    from,
    { text: `┌▣ ◈ *TAGALL* ◈\n│ ${note}\n└▣\n\n${list}`, mentions: ids },
    { quoted: m }
  )
}
