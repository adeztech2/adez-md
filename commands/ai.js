import { aiBox } from '../lib/aibox.js'

export const name = 'ai'
export const category = 'ai'
export const aliases = ['ask']
export const description = 'Ask the AI a question (ai <question>)'

const API_URL = process.env.ADEZ_AI_URL || 'https://text.pollinations.ai/openai'
const MODEL = process.env.ADEZ_AI_MODEL || 'openai'
const TITLE = 'ADEZ MD AI'

const SYSTEM_PROMPT =
  'You are ADEZ MD AI, a helpful WhatsApp assistant from ADEZ Tech in Nairobi, Kenya. ' +
  'Reply in the same language the user writes in. Be clear and reasonably short. ' +
  'Use plain text with simple formatting only. No tables and no headings.'

export async function run({ args, reply, sock, from, prefix }) {
  const question = args.join(' ').trim()
  if (!question) return reply(aiBox(TITLE, `Ask me anything.\nExample: ${prefix}ai what is a VPS?`))

  try { await sock?.sendPresenceUpdate?.('composing', from) } catch {}
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: question }
        ]
      }),
      signal: AbortSignal.timeout(40000)
    })
    if (!res.ok) throw new Error(`AI service returned ${res.status}`)

    const raw = await res.text()
    let answer = raw
    try { answer = JSON.parse(raw)?.choices?.[0]?.message?.content ?? raw } catch {}
    answer = String(answer).trim()
    if (!answer) throw new Error('empty answer')
    if (answer.length > 3000) answer = answer.slice(0, 3000) + '…'

    return reply(aiBox(TITLE, answer)) // answer only, no question row
  } catch (e) {
    console.log('⚠️ ai failed:', e.message)
    return reply(aiBox(TITLE, 'The AI is busy right now. Please try again in a minute.'))
  } finally {
    try { await sock?.sendPresenceUpdate?.('paused', from) } catch {}
  }
}
