import { box } from '../lib/style.js'
import { warnings, MAX_WARNS } from './warn.js'

export const name = 'warnings'
export const category = 'group'
export const description = 'Check or clear warnings: .warnings @user  |  .warnings reset @user'

export async function run({ sock, m, from, args, isGroup, isAdmin, isOwner, reply, resolveJid, prefix }) {
  if (!isGroup) return reply(box('WARNINGS', ['This command works in groups only.']))
  const info = m.message?.extendedTextMessage?.contextInfo
  const raw = info?.mentionedJid?.[0] || info?.participant
  if (!raw) return reply(box('WARNINGS', [`Check: ${prefix}warnings @user`, `Clear: ${prefix}warnings reset @user`]))
  const target = resolveJid(raw)
  const key = `${from}|${target}`
  const tag = '@' + String(target).split('@')[0]
  const send = (rows) => sock.sendMessage(from, { text: box('WARNINGS', rows), mentions: [target] }, { quoted: m })

  if ((args[0] || '').toLowerCase() === 'reset') {
    if (!isAdmin && !isOwner) return reply(box('WARNINGS', ['Only group admins can clear warnings.']))
    warnings.delete(key)
    return send([['user', tag], 'Warnings cleared ✅'])
  }
  return send([['user', tag], ['warnings', `${warnings.get(key) || 0}/${MAX_WARNS}`]])
}
