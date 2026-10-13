import { box } from '../lib/style.js'

export const name = 'block'
export const category = 'owner'
export const aliases = ['unblock']
export const description = 'Block or unblock a number'

export async function run({ sock, from, m, args, command, isGroup, isOwner, resolveJid, prefix, reply }) {
  if (!isOwner) return reply(box('BLOCK', ['⛔ Only the owner can use this.']))

  const ctx = m.message?.extendedTextMessage?.contextInfo
  let target = ctx?.mentionedJid?.[0] || ctx?.participant
  if (!target && args[0]) target = args[0].replace(/\D/g, '') + '@s.whatsapp.net'
  if (!target && !isGroup) target = from
  if (!target) return reply(box('BLOCK', [['usage', `${prefix}${command} 2547xxxxxxxx`], 'Or reply to / mention someone']))

  const jid = resolveJid(target)
  const action = command === 'unblock' ? 'unblock' : 'block'
  try {
    await sock.updateBlockStatus(jid, action)
    await reply(box('BLOCK', [['number', jid.split('@')[0]], ['status', action === 'block' ? 'Blocked 🚫' : 'Unblocked ✅']]))
  } catch (e) {
    console.log('Block failed:', e.message)
    await reply(box('BLOCK', ['Could not do that.']))
  }
}
