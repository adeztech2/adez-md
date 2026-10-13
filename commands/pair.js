import { box, botName } from '../lib/style.js'

export const name = 'pair'
export const category = 'general'
export const aliases = ['link', 'getsession']
export const description = 'Get the pairing page link'

const PAIR_URL = 'https://arnoldadezbot.onrender.com/pair.html'

export async function run({ reply }) {
  await reply(box(`${botName()} PAIR`, [
    ['page', PAIR_URL],
    ['step 1', 'Open the page'],
    ['step 2', 'Enter your number with country code'],
    ['step 3', 'Type the code in WhatsApp > Linked devices']
  ]))
}
