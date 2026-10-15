import { getSetting, setSetting } from '../lib/settings.js'
import { box } from '../lib/style.js'

export const name = 'setprefix'
export const category = 'owner'
export const aliases = ['prefix']
export const description = 'Change the command prefix, or use none for no prefix'

export async function run({ args, prefix, isOwner, reply }) {
  if (!isOwner) return reply(box('PREFIX', ['⛔ Only the owner can use this.']))

  const raw = (args[0] || '').trim()
  const current = getSetting('prefix')
  const shown = current ? `[ ${current} ]` : 'none'

  if (!raw) {
    return reply(box('PREFIX', [
      ['current', shown],
      ['usage', `${prefix}setprefix !`],
      ['no prefix', `${prefix}setprefix none`]
    ]))
  }

  const isNone = ['none', 'off', 'no'].includes(raw.toLowerCase())
  if (!isNone && (raw.length > 3 || /\s/.test(raw))) {
    return reply(box('PREFIX', ['Use 1 to 3 characters with no spaces, for example: . ! # /']))
  }

  // "none" is stored as the word none. getSetting() turns it into an empty prefix.
  const value = isNone ? 'none' : raw

  try {
    await setSetting('prefix', value)
    const label = isNone ? 'none' : `[ ${value} ]`
    const example = isNone ? 'menu' : `${value}menu`
    await reply(box('PREFIX', [['new prefix', label], ['example', example], ['status', '✅ Saved']]))
  } catch (e) {
    console.log('Prefix save failed:', e.message)
    await reply(box('PREFIX', ['Could not save the prefix.']))
  }
}
