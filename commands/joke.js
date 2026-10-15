import { box } from '../lib/style.js'

export const name = 'joke'
export const category = 'fun'
export const description = 'Get a random joke'

const BACKUP = [
  ['Why do programmers prefer dark mode?', 'Because light attracts bugs.'],
  ['Why did the phone go to school?', 'To become a smartphone.'],
  ['What do you call a fake noodle?', 'An impasta.'],
  ['Why was the computer cold?', 'It left its Windows open.']
]

export async function run({ reply }) {
  let setup, punchline
  try {
    const res = await fetch('https://official-joke-api.appspot.com/random_joke', { signal: AbortSignal.timeout(8000) })
    const j = await res.json()
    if (!j.setup || !j.punchline) throw new Error('bad reply')
    ;({ setup, punchline } = j)
  } catch {
    ;[setup, punchline] = BACKUP[Math.floor(Math.random() * BACKUP.length)]
  }
  return reply(box('JOKE', [setup, `${punchline} 😂`]))
}
