import { Sticker } from 'wa-sticker-formatter'
import { getMedia } from '../lib/media.js'
import { box, botName } from '../lib/style.js'

export const name = 'sticker'
export const category = 'media'
export const aliases = ['s', 'stiker']
export const description = 'Turn an image into a sticker'

export async function run({ sock, from, m, prefix, reply }) {
  try {
    const media = await getMedia(sock, m)
    if (!media || media.type !== 'imageMessage') {
      return reply(box('STICKER', [`Reply to an image with ${prefix}sticker`]))
    }
    const sticker = new Sticker(media.buffer, {
      pack: botName(),
      author: 'Arnold Adez',
      type: 'full',
      quality: 60
    })
    await sock.sendMessage(from, { sticker: await sticker.toBuffer() }, { quoted: m })
  } catch (e) {
    console.log('Sticker failed:', e.message)
    await reply(box('STICKER', ['Could not make the sticker.']))
  }
}
