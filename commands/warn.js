import { box } from '../lib/style.js'

// Warnings are kept in memory: they reset when the bot restarts.
export const warnings = new Map() // "groupJid|userJid" -> count
export const MAX_WARNS = 3

export const name = 'warn'
export const category = 'group'
export const description = 'Warn a member (3 warnings = removed)'

export async function run({ sock, m, from, isGroup, isAdmin, isOwner, isBotAdmin, reply, resolveJid, prefix }) {
  if (!isGroup) return reply(box('WARN', ['This command works in groups only.']))
  if (!isAdmin && !isOwner) return reply(box('WARN', ['Only group admins can warn people.']))

  const info = m.message?.extendedTextMessage?.contextInfo
  const raw = info?.mentionedJid?.[0] || info?.participant
  if (!raw) return reply(box('WARN', [`Tag or reply to someone: ${prefix}warn @user`]))
  const target = resolveJid(raw)

  const key = `${from}|${target}`
  const count = (warnings.get(key) || 0) + 1
  warnings.set(key, count)
  const tag = '@' + String(target).split('@')[0]
  const send = (rows) => sock.sendMessage(from, { text: box('WARN', rows), mentions: [target] }, { quoted: m })

  if (count >= MAX_WARNS) {
    warnings.delete(key)
    if (!isBotAdmin) {
      return send([['user', tag], ['warnings', `${MAX_WARNS}/${MAX_WARNS}`], 'I am not an admin, so I cannot remove them.'])
    }
    try {
      await sock.groupParticipantsUpdate(from, [target], 'remove')
      return send([['user', tag], ['warnings', `${MAX_WARNS}/${MAX_WARNS}`], 'Removed from the group 🚫'])
    } catch {
      return reply(box('WARN', ['Could not remove that member.']))
    }
  }
  return send([['user', tag], ['warnings', `${count}/${MAX_WARNS}`]])
}
