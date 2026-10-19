// The message the bot sends to a number right after it links.
// Change the wording or the look here. index.js only calls linkedMessage().
import { box } from './style.js'

const TZ = 'Africa/Nairobi'

function greeting(now) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(now))
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function linkedMessage({ botName, number, isOwner, prefix, commands }, now = new Date()) {
  const when = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(now).replace(',', ' ·')

  const card = box('CONNECTED', [
    ['bot', botName],
    ['number', `+${number}`],
    ['role', isOwner ? 'Owner 👑' : 'User'],
    ['prefix', `[ ${prefix} ]`],
    ['commands', commands],
    ['time', when]
  ])

  return [
    `👋 *${greeting(now)}!*`,
    `*${botName}* is now live on your number ✅`,
    '',
    card,
    '',
    '*⚡ Quick start*',
    `▸ *${prefix}menu* – see every command`,
    `▸ *${prefix}ping* – check the speed`,
    `▸ *${prefix}pair 2547XXXXXXXX* – link another number`,
    '',
    '_Powered by ADEZ TECH_'
  ].join('\n')
}
