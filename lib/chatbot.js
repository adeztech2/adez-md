// ============================================================
//  lib/chatbot.js - AI chatbot that answers normal messages
//  Plain text replies only (no box / style).
//  Setting (per connected number):  chatbot = on / off
//  - Private chats: replies to every normal message
//  - Groups: only when the bot is mentioned or someone replies to it
//  Uses the free Pollinations API (override with ADEZ_AI_URL / ADEZ_AI_MODEL)
// ============================================================
import { getSetting } from './settings.js'

const API_URL = process.env.ADEZ_AI_URL || 'https://text.pollinations.ai/openai'
const MODEL = process.env.ADEZ_AI_MODEL || 'openai'

const SYSTEM_PROMPT =
  'You are ADEZ AI, a friendly WhatsApp assistant from ADEZ Tech in Nairobi, Kenya, built by Arnold Adez. ' +
  'Chat naturally like a helpful friend. Reply in the same language the user writes in. ' +
  'Keep answers short (1 to 4 sentences unless more is needed). Plain text only: no headings, no tables.'

const HISTORY_TURNS = 6
const HISTORY_TTL_MS = 30 * 60 * 1000
const history = new Map() // chat -> { at, messages }
const lastReplyAt = new Map() // chat -> timestamp (simple flood guard)

const digits = (jid = '') => String(jid).split('@')[0].split(':')[0].replace(/\D/g, '')

function getHistory(chat) {
  const h = history.get(chat)
  return !h || Date.now() - h.at > HISTORY_TTL_MS ? [] : h.messages
}
function saveHistory(chat, messages) {
  history.set(chat, { at: Date.now(), messages: messages.slice(-HISTORY_TURNS * 2) })
  if (history.size > 300) history.delete(history.keys().next().value)
}

async function askAI(chat, text) {
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...getHistory(chat), { role: 'user', content: text }]
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages }),
    signal: AbortSignal.timeout(40000)
  })
  if (!res.ok) throw new Error(`AI service returned ${res.status}`)
  const raw = await res.text()
  let answer = raw
  try { answer = JSON.parse(raw)?.choices?.[0]?.message?.content ?? raw } catch {}
  answer = String(answer).trim()
  if (!answer) throw new Error('empty answer')
  saveHistory(chat, [...getHistory(chat), { role: 'user', content: text }, { role: 'assistant', content: answer }])
  return answer.length > 3000 ? answer.slice(0, 3000) + '…' : answer
}

export async function chatbotReply(sock, m) {
  if (getSetting('chatbot') !== 'on') return

  const key = m?.key
  if (!key?.id || key.fromMe) return

  const jid = key.remoteJid || ''
  if (!jid || jid === 'status@broadcast' || jid.endsWith('@newsletter') || jid.endsWith('@broadcast')) return

  const msg = m.message?.ephemeralMessage?.message || m.message
  if (!msg) return
  if (msg.reactionMessage || msg.protocolMessage || msg.pollUpdateMessage) return

  const text = (msg.conversation || msg.extendedTextMessage?.text || '').trim()
  if (!text) return

  // commands are handled by the normal command system
  const prefix = getSetting('prefix') || '.'
  if (text.startsWith(prefix)) return

  // skip old messages (history sync, reconnects)
  const ts = Number(m.messageTimestamp || 0)
  if (ts && Date.now() / 1000 - ts > 60) return

  const isGroup = jid.endsWith('@g.us')
  if (isGroup) {
    const me = digits(sock.user?.id)
    const ctx = msg.extendedTextMessage?.contextInfo
    const mentioned = (ctx?.mentionedJid || []).some((j) => digits(j) === me)
    const repliedToBot = digits(ctx?.participant) === me
    if (!mentioned && !repliedToBot) return
  }

  // flood guard: at most one reply per chat every 2 seconds
  const now = Date.now()
  if (now - (lastReplyAt.get(jid) || 0) < 2000) return
  lastReplyAt.set(jid, now)

  try { await sock.sendPresenceUpdate('composing', jid) } catch {}
  try {
    const answer = await askAI(jid, text)
    await sock.sendMessage(jid, { text: answer }, { quoted: m })
  } catch (e) {
    console.log('⚠️ chatbot failed:', e.message) // stay quiet in chat on errors
  } finally {
    try { await sock.sendPresenceUpdate('paused', jid) } catch {}
  }
}
