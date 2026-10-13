import { askAI } from '../lib/ai.js'

export const name = 'deepseek'
export const category = 'ai'
export const description = 'Ask DeepSeek AI'

export async function run(ctx) {
  await askAI(ctx, 'deepseek', 'deepseek', 'DEEPSEEK')
}
