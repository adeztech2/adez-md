// ============================================================
//  lib/ai.js - AI client used by the AI commands
//  Works with any OpenAI-compatible chat API (DeepSeek, OpenRouter, etc.)
//
//  Set these in Render:
//    AI_API_URL  e.g. https://api.deepseek.com/v1/chat/completions
//    AI_API_KEY  your API key
//    AI_MODEL    e.g. deepseek-chat
// ============================================================

const AI_API_URL = process.env.AI_API_URL || 'https://api.deepseek.com/v1/chat/completions'
const AI_API_KEY = process.env.AI_API_KEY || ''
const AI_MODEL = process.env.AI_MODEL || 'deepseek-chat'

// Sends one prompt and returns the reply text.
// Usage: const answer = await askAI('What is the capital of France?')
// Optional: askAI(prompt, { system: 'You are a helpful assistant', timeout: 60000 })
export async function askAI(prompt, { system = 'You are a helpful assistant.', timeout = 60000 } = {}) {
  if (!AI_API_KEY) throw new Error('AI_API_KEY is not set')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const res = await fetch(AI_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: String(prompt) }
        ]
      })
    })

    if (!res.ok) throw new Error(`AI service returned ${res.status}`)

    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content
    if (!text) throw new Error('AI service returned an empty reply')
    return text.trim()
  } finally {
    clearTimeout(timer)
  }
}
