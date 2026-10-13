import { askAI } from '../lib/ai.js'

export const name = 'ai'
export const category = 'ai'
export const aliases = ['ask']
export const description = 'Ask the AI a question'

export async function run(ctx) {
  await askAI(ctx, 'ai', 'openai', 'AI')
}
