import { getChannelJid } from '../lib/channel.js'

export const name = 'channeljid'
export const category = 'owner'
export const aliases = []
export const description = 'Show the resolved channel JID'

export async function run({ reply, isOwner }) {
  if (!isOwner) return reply('⛔ Owner only.')
  return reply('Channel JID: ' + (getChannelJid() || 'not resolved yet'))
}
