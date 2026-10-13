import { getMedia } from '../lib/media.js'
import { box } from '../lib/style.js'

export const name = 'setpp'
export const category = 'owner'
export const aliases = ['setdp']
export const description = 'Change the bot profile picture'

export async function run({ sock, m, prefix, isOwner, reply }) {
  if (!isOwner) return reply(box('SETPP', ['⛔ Only the owner can use this.']))

  try {
    const media = await getMedia(sock, m)
    if (!media || media.type !== 'imageMessage') {
      return reply(box('SETPP', [`Reply to an image with ${prefix}setpp`]))
    }
    const botJid = String(sock.user.id).split(':')[0].split('@')[0] + '@s.whatsapp.net'
    await sock.updateProfilePicture(botJid, media.buffer)
    await reply(box('SETPP', [['status', 'Profile picture updated ✅']]))
  } catch (e) {
    console.log('Setpp failed:', e.message)
    await reply(box('SETPP', ['Could not change the picture.']))
  }
}
