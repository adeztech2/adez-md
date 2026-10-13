import { askAI } from '../lib/ai.js'

export const name = 'llama'
export const category = 'ai'
export const description = 'Ask Llama AI'

export async function run(ctx) {
  await askAI(ctx, 'llama', 'llama', 'LLAMA')
}
