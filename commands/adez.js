// ============================================================
//  commands/adez.js - ADEZ AI (free, no API key)
//  Uses the free Pollinations text API. Optional overrides in Render:
//    ADEZ_AI_URL    = full chat endpoint (OpenAI-style), default below
//    ADEZ_AI_MODEL  = model name, default "openai"
// ============================================================
export const name = 'adez'
export const category = 'ai'
export const aliases = ['adezai', 'askadez']
export const description = 'Chat with ADEZ AI (adez <question> / adez reset)'

const API_URL = process.env.ADEZ_AI_URL || 'https://text.pollinations.ai/openai'
const MODEL = process.env.ADEZ_AI_MODEL || 'openai'

const SYSTEM_PROMPT =
  'You are ADEZ AI, the friendly assistant of ADEZ TECH, a technology company in Nairobi, Kenya, ' +
  'built by Arnold Adez. ADEZ TECH offers web development, WhatsApp bot deployment, social media ' +
  'boosting and VPS hosting. Answer clearly and briefly, in the same language the user writes in. ' +
  'Keep replies short enough to read comfortably on WhatsApp, and use simple formatting only.'

// short memory per chat so follow-up questions make sense
const HISTORY_TURNS = 6
const HISTORY_TTL_MS = 30 * 60 * 1000
const history = new Map() // chat -> { at, messages: [] }

function getHistory(chat) {
  const h = history.get(chat)
  if (!h || Date.now() - h.at > HISTORY_TTL_MS) return []
  return h.messages
}
function saveHistory(chat, messages) {
  history.set(chat, { at: Date.now(), messages: messages.slice(-HISTORY_TURNS * 2) })
  if (history.size > 200) history.delete(history.keys().next().value)
}

async function askAI(chat, question) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...getHistory(chat),
    { role: 'user', content: question }
  ]

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages }),
    signal: AbortSignal.timeout(40000)
  })
  if (!res.ok) throw new Error(`AI service returned ${res.status}`)

  const raw = await res.text()
  let answer = raw
  try {
    const data = JSON.parse(raw)
    answer = data?.choices?.[0]?.message?.content ?? raw
  } catch {} // some endpoints return plain text
  answer = String(answer).trim()
  if (!answer) throw new Error('empty answer')

  saveHistory(chat, [...getHistory(chat), { role: 'user', content: question }, { role: 'assistant', content: answer }])
  return answer.length > 3500 ? answer.slice(0, 3500) + '…' : answer
}

export async function run({ args, reply, sock, from, prefix }) {
  const question = args.join(' ').trim()

  if (!question) {
    return reply(
      `🤖 *ADEZ AI*\n\nAsk me anything:\n${prefix}adez what is a VPS?\n${prefix}adez write a short bio for my shop\n\n_${prefix}adez reset - clear this chat's memory_`
    )
  }

  if (question.toLowerCase() === 'reset') {
    history.delete(from)
    return reply('🤖 ADEZ AI memory cleared for this chat.')
  }

  try { await sock?.sendPresenceUpdate?.('composing', from) } catch {}

  try {
    const answer = await askAI(from, question)
    return reply(`🤖 *ADEZ AI*\n\n${answer}`)
  } catch (e) {
    console.log('⚠️ adez ai failed:', e.message)
    return reply('⚠️ ADEZ AI is busy or unavailable right now. Please try again in a minute.')
  } finally {
    try { await sock?.sendPresenceUpdate?.('paused', from) } catch {}
  }
}
