import { box } from '../lib/style.js'

export const name = 'promote'
export const category = 'group'
export const description = 'Make a member an admin'

export async function run({ sock, from, m, isGroup, isAdmin, isOwner, isBotAdmin, resolveJid, reply }) {
  if (!isGroup) return reply(box('PROMOTE', ['This works in groups only.']))
  if (!isAdmin && !isOwner) return reply(box('PROMOTE', ['⛔ Admins only.']))
  if (!isBotAdmin) return reply(box('PROMOTE', ['Make the bot an admin first.']))

  const ctxInfo = m.message?.extendedTextMessage?.contextInfo
  const target = ctxInfo?.mentionedJid?.[0] || ctxInfo?.participant
  if (!target) return reply(box('PROMOTE', ['Mention someone or reply to their message.']))

  const jid = resolveJid(target)
  try {
    await sock.groupParticipantsUpdate(from, [jid], 'promote')
    await reply(box('PROMOTE', [['admin', `@${jid.split('@')[0]}`], ['status', '✅ Done']]))
  } catch (e) {
    console.log('Promote failed:', e.message)
    await reply(box('PROMOTE', ['Could not promote that member.']))
  }
}
