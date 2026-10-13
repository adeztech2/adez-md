import { setSetting, getSetting } from '../lib/settings.js'
import { updateBioNow } from '../lib/autobio.js'
import { box } from '../lib/style.js'

export const name = 'autobio'
export const category = 'owner'
export const description = 'Auto-update the bot About text'

export async function run({ sock, args, prefix, isOwner, reply }) {
  if (!isOwner) return reply(box('AUTOBIO', ['⛔ Only the owner can use this.']))

  const choice = args[0]?.toLowerCase()
  if (!['on', 'off'].includes(choice)) {
    return reply(box('AUTOBIO', [['status', getSetting('autobio') === 'on' ? 'On' : 'Off'], ['usage', `${prefix}autobio on / off`]]))
  }

  try {
    await setSetting('autobio', choice)
    if (choice === 'on') await updateBioNow(sock)
    await reply(box('AUTOBIO', [['status', choice === 'on' ? 'On ✅ (updates every 5 minutes)' : 'Off']]))
  } catch (e) {
    console.log('Autobio failed:', e.message)
    await reply(box('AUTOBIO', ['Could not change this setting.']))
  }
}
