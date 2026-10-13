import axios from 'axios'
import { box, botName } from './style.js'

export async function askAI({ sock, from, m, args, prefix, reply }, cmd, model, label) {
  const title = `${botName()} ${label}`
  const question = args.join(' ').trim()
  if (!question) return reply(box(title, [['usage', `${prefix}${cmd} <question>`]]))

  try {
    await sock.sendMessage(from, { react: { text: '🤖', key: m.key } })
    const res = await axios.get(
      `https://text.pollinations.ai/${encodeURIComponent(question)}`,
      { params: { model }, timeout: 60000, responseType: 'text' }
    )
    const answer = String(res.data || '').trim()
    if (!answer) return reply(box(title, ['The AI gave no answer. Try again.']))
    await reply(box(title, [['question', question]]) + `\n\n${answer}`)
  } catch (e) {
    console.log(`${cmd} failed:`, e.message)
    await reply(box(title, ['The AI is busy. Try again later.']))
  }
}
