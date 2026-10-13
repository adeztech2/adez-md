import { getSetting, setSetting } from '../lib/settings.js'
import { box } from '../lib/style.js'

export const name = 'setprefix'
export const category = 'owner'
export const aliases = ['prefix']
export const description = 'Change the command prefix'

export async function run({ args, prefix, isOwner, reply }) {
  if (!isOwner) return reply(box('PREFIX', ['⛔ Only the owner can use this.']))

  const value = args[0]
  if (!value) {
    return reply(box('PREFIX', [['current', `[ ${getSetting('prefix')} ]`], ['usage', `${prefix}setprefix !`]]))
  }
  if (value.length > 3) {
    return reply(box('PREFIX', ['Use 1 to 3 characters, for example: . ! # /']))
  }

  try {
    await setSetting('prefix', value)
    await reply(box('PREFIX', [['new prefix', `[ ${value} ]`], ['example', `${value}menu`], ['status', '✅ Saved']]))
  } catch (e) {
    console.log('Prefix save failed:', e.message)
    await reply(box('PREFIX', ['Could not save the prefix.']))
  }
}
