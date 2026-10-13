import { box } from '../lib/style.js'

export const name = 'demote'
export const category = 'group'
export const description = 'Remove admin rights from a member'

export async function run({ sock, from, m, isGroup, isAdmin, isOwner, isBotAdmin, resolveJid, reply }) {
  if (!isGroup) return reply(box('DEMOTE', ['This works in groups only.']))
  if (!isAdmin && !isOwner) return reply(box('DEMOTE', ['⛔ Admins only.']))
  if (!isBotAdmin) return reply(box('DEMOTE', ['Make the bot an admin first.']))

  const ctxInfo = m.message?.extendedTextMessage?.contextInfo
  const target = ctxInfo?.mentionedJid?.[0] || ctxInfo?.participant
  if (!target) return reply(box('DEMOTE', ['Mention someone or reply to their message.']))

  const jid = resolveJid(target)
  try {
    await sock.groupParticipantsUpdate(from, [jid], 'demote')
    await reply(box('DEMOTE', [['demoted', `@${jid.split('@')[0]}`], ['status', '✅ Done']]))
  } catch (e) {
    console.log('Demote failed:', e.message)
    await reply(box('DEMOTE', ['Could not demote that member.']))
  }
}
