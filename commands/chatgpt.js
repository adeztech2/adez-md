import { askAI } from '../lib/ai.js'

export const name = 'chatgpt'
export const category = 'ai'
export const aliases = ['gpt']
export const description = 'Ask ChatGPT-style AI'

export async function run(ctx) {
  await askAI(ctx, 'chatgpt', 'openai', 'CHATGPT')
}
