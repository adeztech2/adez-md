import { box, botName } from '../lib/style.js'

export const name = 'uptime'
export const category = 'general'
export const aliases = ['runtime']
export const description = 'How long the bot has been running'

export async function run({ reply }) {
  const s = Math.floor(process.uptime())
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60), sec = s % 60
  const up = [d && `${d}d`, (d || h) && `${h}h`, `${m}m`, `${sec}s`].filter(Boolean).join(' ')
  const mem = Math.round(process.memoryUsage().rss / 1024 / 1024)
  return reply(box(`${botName()} UPTIME`, [
    ['running for', up],
    ['memory', `${mem} MB`],
    ['node', process.version]
  ]))
}
