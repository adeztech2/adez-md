import { box } from '../lib/style.js'

export const name = 'restart'
export const category = 'owner'
export const aliases = ['reboot']
export const description = 'Restart the bot'

export async function run({ isOwner, reply }) {
  if (!isOwner) return reply(box('RESTART', ['⛔ Only the owner can use this.']))

  await reply(box('RESTART', [['status', 'Restarting... ♻️'], 'Back in about a minute']))
  setTimeout(() => process.kill(process.pid, 'SIGTERM'), 1500)
}
