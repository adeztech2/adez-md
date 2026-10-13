import { getMedia } from '../lib/media.js'
import { box } from '../lib/style.js'

export const name = 'vv'
export const category = 'media'
export const aliases = ['reveal']
export const description = 'Reveal a view-once photo or video'

export async function run({ sock, from, m, prefix, isOwner, reply }) {
  if (!isOwner) return reply(box('VV', ['⛔ Only the owner can use this.']))
  try {
    const media = await getMedia(sock, m)
    if (!media || media.type === 'stickerMessage') {
      return reply(box('VV', [`Reply to a photo or video with ${prefix}vv`]))
    }
    const content = media.type === 'imageMessage'
      ? { image: media.buffer, caption: media.caption }
      : { video: media.buffer, caption: media.caption }
    await sock.sendMessage(from, content, { quoted: m })
  } catch (e) {
    console.log('VV failed:', e.message)
    await reply(box('VV', ['Could not open that message.']))
  }
}
