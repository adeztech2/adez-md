import axios from 'axios'
import { box } from '../lib/style.js'

export const name = 'quote'
export const category = 'fun'
export const description = 'Get an inspiring quote'

export async function run({ reply }) {
  try {
    const { data } = await axios.get('https://zenquotes.io/api/random', { timeout: 15000 })
    const q = data?.[0]
    if (!q?.q) throw new Error('empty')
    await reply(box('QUOTE', [`"${q.q}"`, ['author', q.a]]))
  } catch (e) {
    console.log('Quote failed:', e.message)
    await reply(box('QUOTE', ['Could not get a quote. Try again.']))
  }
}
