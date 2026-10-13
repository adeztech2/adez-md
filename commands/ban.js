import { getSetting, setSetting } from '../lib/settings.js'
import { box } from '../lib/style.js'

export const name = 'ban'
export const category = 'owner'
export const aliases = ['unban', 'banlist']
export const description = 'Ban or unban a person from using the bot'

function readList() {
  try { return JSON.parse(getSetting('banned') || '[]') } catch { return [] }
}

export async function run({ m, args, command, prefix, isOwner, resolveJid, reply }) {
  if (!isOwner) return reply(box('BAN', ['⛔ Only the owner can use this.']))

  const list = readList()

  if (command === 'banlist') {
    return reply(box('BAN LIST', list.length ? list.map((n) => `+${n}`) : ['Nobody is banned.']))
  }

  const ctx = m.message?.extendedTextMessage?.contextInfo
  let target = ctx?.mentionedJid?.[0] || ctx?.participant
  if (!target && args[0]) target = args[0].replace(/\D/g, '') + '@s.whatsapp.net'
  if (!target) return reply(box('BAN', [['usage', `${prefix}${command} 2547xxxxxxxx`], 'Or reply to / mention someone']))

  const number = resolveJid(target).split('@')[0].split(':')[0]
  const unbanning = command === 'unban'
  const next = unbanning ? list.filter((n) => n !== number) : [...new Set([...list, number])]

  try {
    await setSetting('banned', JSON.stringify(next))
    await reply(box('BAN', [['number', `+${number}`], ['status', unbanning ? 'Unbanned ✅' : 'Banned 🚫']]))
  } catch (e) {
    console.log('Ban failed:', e.message)
    await reply(box('BAN', ['Could not save the ban list.']))
  }
}
