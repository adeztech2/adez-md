import { box, botName, sendCard } from '../lib/style.js'

export const name = 'repo'
export const category = 'general'
export const aliases = ['script', 'source']
export const description = 'Show the bot repository link'

const REPO_URL = 'https://github.com/adeztech2/adez-md'

function uptime() {
  const s = Math.floor(process.uptime())
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${m}m`
}

export async function run(ctx) {
  const { prefix } = ctx

  const text =
    box(`${botName()} REPO`, [
      ['repository', REPO_URL],
      ['developer', 'Arnold Adez'],
      ['contact', 'wa.me/254111783552'],
      ['uptime', uptime()],
      ['prefix', `[ ${prefix} ]`],
      ['host', 'Render']
    ]) + `\n\n⭐ _Don't forget to star and fork the repo!_`

  await sendCard(ctx, text)
}
