import { box, botName } from '../lib/style.js'

export const name = 'alive'
export const category = 'general'
export const description = 'Check if the bot is online'

export async function run({ reply, getAllCommands }) {
  const s = Math.floor(process.uptime())
  await reply(box(`${botName()} ALIVE`, [
    ['status', 'Online ✅'],
    ['commands', getAllCommands().length],
    ['uptime', `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`]
  ]))
}
