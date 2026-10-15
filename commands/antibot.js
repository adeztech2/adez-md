import { getSetting } from '../lib/settings.js'
import { box } from '../lib/style.js'

export const name = 'antibot'

// A guess based on the message ID. Messages sent by other Baileys bots often start with
// "BAE5", or are a very long "3EB0..." ID. Real WhatsApp apps use shorter IDs.
// It can be wrong, so this only deletes the message and warns. It never removes anyone.
export function looksLikeBot(id = '') {
  return /^BAE5/.test(id) || (id.startsWith('3EB0') && id.length >= 32)
}

const num = (jid = '') => String(jid).split('@')[0].split(':')[0]

export async function run(ctx) {
  const { sock, m, from, sender, isGroup, isAdmin, isBotAdmin, isOwner } = ctx
  if (!isGroup || m.key.fromMe) return
  if (isAdmin || isOwner || !isBotAdmin) return
  if (!looksLikeBot(m.key.id)) return

  let map = {}
  try { map = JSON.parse(getSetting('antibot') || '{}') } catch { return }
  if (map[from] !== 'on') return

  try {
    await sock.sendMessage(from, { delete: m.key })
    await sock.sendMessage(from, {
      text: box('ANTI-BOT', [['user', '@' + num(sender)], 'Bot messages are not allowed here. Message deleted.']),
      mentions: [sender]
    })
  } catch (e) {
    console.log('Antibot failed:', e.message)
  }
}
