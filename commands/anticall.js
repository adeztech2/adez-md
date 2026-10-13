import { getSetting, setSetting } from '../lib/settings.js'
import { box } from '../lib/style.js'

export const name = 'anticall'
export const category = 'owner'
export const description = 'Automatically reject incoming calls'

export async function run({ args, prefix, isOwner, reply }) {
  if (!isOwner) return reply(box('ANTICALL', ['⛔ Only the owner can use this.']))

  const choice = args[0]?.toLowerCase()
  if (!['on', 'off'].includes(choice)) {
    return reply(box('ANTICALL', [
      ['status', getSetting('anticall') === 'on' ? 'On' : 'Off'],
      ['usage', `${prefix}anticall on / off`]
    ]))
  }

  try {
    await setSetting('anticall', choice)
    await reply(box('ANTICALL', [['status', choice === 'on' ? 'On ✅ Calls will be rejected' : 'Off']]))
  } catch (e) {
    console.log('Anticall save failed:', e.message)
    await reply(box('ANTICALL', ['Could not save this setting.']))
  }
}
