import { getSetting } from '../lib/settings.js'

export const name = 'chatbot'

// Uses the answer engine of your existing AI command (default: .ai).
// To use another one, set CHATBOT_CMD in Render (for example chatgpt, deepseek or llama).
const COOLDOWN_MS = 4000
const last = new Map()
const num = (jid = '') => String(jid).split('@')[0].split(':')[0]

export async function run(ctx) {
  const { sock, m, from, text, sender, isGroup, prefix } = ctx

  if (getSetting('chatbot') !== 'on') return
  if (m.key.fromMe || !text || text.startsWith(prefix)) return
  if (from.endsWith('@broadcast') || from.endsWith('@newsletter')) return

  // In groups, only answer when the bot is tagged or replied to
  if (isGroup) {
    const ids = [num(sock.user?.id), num(sock.user?.lid)].filter(Boolean)
    const mm = m.message?.ephemeralMessage?.message || m.message || {}
    const info = (mm.extendedTextMessage || mm.imageMessage || mm.videoMessage)?.contextInfo
    const mentioned = (info?.mentionedJid || []).some((j) => ids.includes(num(j)))
    const replied = !!info?.participant && ids.includes(num(info.participant))
    if (!mentioned && !replied) return
  }

  // One answer per person every few seconds (stops spam and bot-to-bot loops)
  const key = `${num(sock.user?.id)}:${num(sender)}`
  const now = Date.now()
  if (now - (last.get(key) || 0) < COOLDOWN_MS) return
  last.set(key, now)
  if (last.size > 2000) last.delete(last.keys().next().value)

  const question = text.replace(/@\d+/g, '').trim().slice(0, 500)
  if (!question) return

  const cmdName = (process.env.CHATBOT_CMD || 'ai').toLowerCase()
  const cmd = ctx.getAllCommands().find((c) => c.name === cmdName)
  if (!cmd) {
    console.log(`⚠️ chatbot: command "${cmdName}" not found`)
    return
  }

  try {
    await sock.sendPresenceUpdate('composing', from)
    await cmd.run({
      ...ctx,
      args: question.split(/\s+/),
      command: cmdName,
      text: `${prefix}${cmdName} ${question}`
    })
  } catch (e) {
    console.log('⚠️ chatbot error:', e.message)
  } finally {
    try { await sock.sendPresenceUpdate('paused', from) } catch {}
  }
}
  
