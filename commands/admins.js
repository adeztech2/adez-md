import { box } from '../lib/style.js'

export const name = 'admins'
export const category = 'group'
export const aliases = ['listadmin']
export const description = 'List the group admins'

export async function run({ sock, m, from, isGroup, groupMetadata, reply }) {
  if (!isGroup) return reply(box('ADMINS', ['This command works in groups only.']))
  const list = (groupMetadata?.participants || []).filter((p) => p.admin === 'admin' || p.admin === 'superadmin')
  if (!list.length) return reply(box('ADMINS', ['Could not read the admin list. Try again.']))
  const jids = list.map((p) => p.phoneNumber || p.id)
  const rows = list.map((p, i) => `${i + 1}. @${String(jids[i]).split('@')[0].split(':')[0]}${p.admin === 'superadmin' ? ' 👑' : ''}`)
  return sock.sendMessage(from, { text: box(`ADMINS (${list.length})`, rows), mentions: jids }, { quoted: m })
}
