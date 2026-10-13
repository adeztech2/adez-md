import { box } from '../lib/style.js'

export const name = 'kick'
export const category = 'group'
export const aliases = ['remove']
export const description = 'Remove a member from the group'

export async function run({ sock, from, m, isGroup, isAdmin, isOwner, isBotAdmin, resolveJid, reply }) {
  if (!isGroup) return reply(box('KICK', ['This works in groups only.']))
  if (!isAdmin && !isOwner) return reply(box('KICK', ['⛔ Admins only.']))
  if (!isBotAdmin) return reply(box('KICK', ['Make the bot an admin first.']))

  const ctxInfo = m.message?.extendedTextMessage?.contextInfo
  const target = ctxInfo?.mentionedJid?.[0] || ctxInfo?.participant
  if (!target) return reply(box('KICK', ['Mention someone or reply to their message.']))

  const jid = resolveJid(target)
  try {
    await sock.groupParticipantsUpdate(from, [jid], 'remove')
    await reply(box('KICK', [['removed', `@${jid.split('@')[0]}`], ['status', '✅ Done']]))
  } catch (e) {
    console.log('Kick failed:', e.message)
    await reply(box('KICK', ['Could not remove that member.']))
  }
  }
