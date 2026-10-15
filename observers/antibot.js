import { getSetting } from '../lib/settings.js'
import { box } from '../lib/style.js'

export const name = 'antibot'

// A guess based on the message ID. Messages sent by other Baileys bots often start with
// "BAE5", or are a very long "3EB0..." ID. Real WhatsApp apps use shorter IDs.
// It can be wrong, so this only deletes the message and warns. It never removes anyone.
export function looksLikeBot(id = '') {
  return /^BAE5/.test(id) || (id.startsWith('3EB0') && id.length >= 32)
}

export async function run({ sock, m, from, isGroup, isAdmin, isOwner, isBotAdmin }) {
  if (!isGroup || m.key.fromMe) return
  if (isAdmin || isOwner || !isBotAdmin) return
  if (!looksLikeBot(m.key.id)) return

  let map = {}
  try { map = JSON.parse(getSetting('antibot') || '{}') } catch {}
  if (map[from] !== 'on') return

  try {
    await sock.sendMessage(from, { delete: m.key })
    const who = m.key.participant || m.participant
    await sock.sendMessage(from, {
      text: box('ANTI-BOT', [['user', '@' + String(who).split('@')[0].split(':')[0]], 'Bot messages are not allowed here. Message deleted.']),
      mentions: who ? [who] : []
    })
  } catch (e) {
    console.log('Antibot failed:', e.message)
  }
      }
