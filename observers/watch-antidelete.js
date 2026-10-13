import { getSetting } from '../lib/settings.js'

export const name = 'antidelete'

// Recent messages kept in memory (cleared when the bot restarts)
const store = new Map()
const MAX = 1500
const num = (jid = '') => String(jid).split('@')[0].split(':')[0]

export async function run(ctx) {
  const { sock, m, isGroup } = ctx
  const mode = getSetting('antidelete') // 'off' | 'on' | 'chat'
  if (mode !== 'on' && mode !== 'chat') return

  const who = num(sock.user?.id)
  const pm = m.message?.protocolMessage
  const isRevoke = pm && (pm.type === 0 || pm.type === 'REVOKE')

  // A normal message: remember it
  if (!isRevoke) {
    if (m.key.fromMe || !m.message) return
    store.set(`${who}:${m.key.id}`, m)
    if (store.size > MAX) store.delete(store.keys().next().value)
    return
  }

  // Someone deleted a message
  if (m.key.fromMe) return
  const storeKey = `${who}:${pm.key?.id}`
  const orig = store.get(storeKey)
  if (!orig) return
  store.delete(storeKey)

  // Never recover view-once media
  const msg = orig.message || {}
  if (msg.viewOnceMessage || msg.viewOnceMessageV2 || msg.viewOnceMessageV2Extension) return

  const author = orig.key.participant || orig.key.remoteJid
  const target = mode === 'chat' ? ctx.from : who + '@s.whatsapp.net'
  const head = `🗑️ *Deleted message*\n👤 @${num(author)}\n💬 ${isGroup ? 'Group' : 'Private chat'}`

  try {
    await sock.sendMessage(target, { text: head, mentions: [author] })
    await sock.sendMessage(target, { forward: orig })
  } catch (e) {
    const t = msg.conversation || msg.extendedTextMessage?.text
    if (t) {
      try { await sock.sendMessage(target, { text: t }) } catch {}
    }
    console.log(`⚠️ antidelete could not resend: ${e.message}`)
  }
}
