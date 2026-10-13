import { getSetting } from '../lib/settings.js'

export const name = 'antilink'

const LINK = /(https?:\/\/|www\.|chat\.whatsapp\.com\/|wa\.me\/)\S+/i
const num = (jid = '') => String(jid).split('@')[0].split(':')[0]

export async function run(ctx) {
  const { sock, m, text, from, sender, isGroup, isAdmin, isBotAdmin, isOwner } = ctx
  if (!isGroup || !text || m.key.fromMe) return
  if (isAdmin || isOwner || !isBotAdmin) return

  let map = {}
  try { map = JSON.parse(getSetting('antilink') || '{}') } catch { return }
  const mode = map[from]
  if (!mode || !LINK.test(text)) return

  try { await sock.sendMessage(from, { delete: m.key }) } catch {}

  if (mode === 'kick') {
    try {
      await sock.groupParticipantsUpdate(from, [sender], 'remove')
      await sock.sendMessage(from, { text: `🚫 @${num(sender)} was removed for sending a link.`, mentions: [sender] })
    } catch (e) {
      console.log(`⚠️ antilink could not remove member: ${e.message}`)
    }
  } else {
    await sock.sendMessage(from, { text: `⚠️ @${num(sender)} links are not allowed in this group.`, mentions: [sender] })
  }
}
