import { getSetting, setSetting } from '../lib/settings.js'
import { box } from '../lib/style.js'
import { getEmojis, DEFAULT_EMOJIS } from '../lib/autoreact.js'

export const name = 'autoreact'
export const category = 'owner'
export const aliases = ['areact']
export const description = 'Auto react: on / off / emojis / status'

// split "😂❤️🔥" or "😂 ❤️ 🔥" into single emojis
function splitEmojis(text) {
  const seg = new Intl.Segmenter('en', { granularity: 'grapheme' })
  return [...seg.segment(text)]
    .map((x) => x.segment)
    .filter((x) => x.trim() && /\p{Extended_Pictographic}/u.test(x))
}

export async function run({ args, reply, isOwner, prefix }) {
  if (!isOwner) return reply('⛔ Owner only.')

  const sub = (args[0] || '').toLowerCase()
  const state = getSetting('autoreact') === 'on' ? 'on' : 'off'
  const statusState = getSetting('autoreact_status') === 'on' ? 'on' : 'off'
  const cmdState = getSetting('autoreact_cmds') === 'off' ? 'off' : 'on'

  if (sub === 'on' || sub === 'off') {
    await setSetting('autoreact', sub)
    return reply(box('AUTO REACT', [['status', sub]]))
  }

  if (sub === 'commands') {
    const v = (args[1] || '').toLowerCase()
    if (!['on', 'off'].includes(v)) return reply(`Use: ${prefix}autoreact commands on / off`)
    await setSetting('autoreact_cmds', v)
    return reply(box('AUTO REACT', [['command emojis', v]]))
  }

  if (sub === 'status') {
    const v = (args[1] || '').toLowerCase()
    if (!['on', 'off'].includes(v)) return reply(`Use: ${prefix}autoreact status on / off`)
    await setSetting('autoreact_status', v)
    return reply(box('AUTO REACT', [['react to statuses', v]]))
  }

  if (sub === 'emojis') {
    const rest = args.slice(1).join(' ')
    if (rest.toLowerCase() === 'reset') {
      await setSetting('autoreact_emojis', '[]')
      return reply(box('AUTO REACT', [['emojis', 'reset to default'], DEFAULT_EMOJIS.join(' ')]))
    }
    const list = splitEmojis(rest)
    if (!list.length) return reply(`Use: ${prefix}autoreact emojis 😂 ❤️ 🔥\nor: ${prefix}autoreact emojis reset`)
    await setSetting('autoreact_emojis', JSON.stringify(list))
    return reply(box('AUTO REACT', [['emojis saved', list.length], list.join(' ')]))
  }

  return reply(
    box('AUTO REACT', [
      ['status', state],
      ['command emojis', cmdState],
      ['statuses', statusState],
      ['emojis', getEmojis().join(' ')],
      `${prefix}autoreact on / off`,
      `${prefix}autoreact commands on / off`,
      `${prefix}autoreact status on / off`,
      `${prefix}autoreact emojis 😂 ❤️ 🔥`,
      `${prefix}autoreact emojis reset`
    ])
  )
}
