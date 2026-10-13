import axios from 'axios'
import { box } from '../lib/style.js'

export const name = 'fact'
export const category = 'fun'
export const description = 'Get a random fact'

export async function run({ reply }) {
  try {
    const { data } = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en', { timeout: 15000 })
    await reply(box('FACT', [`💡 ${data.text}`]))
  } catch (e) {
    console.log('Fact failed:', e.message)
    await reply(box('FACT', ['Could not get a fact. Try again.']))
  }
}
