import { box } from '../lib/style.js'
import { getMedia } from '../lib/downloader.js'

export const name = 'instagram'
export const category = 'download'
export const aliases = ['ig', 'insta']
export const description = 'Download an Instagram reel or post: .ig <link>'

// Free APIs, tried in order. They come and go. To add your own, set INSTA_API in Render
// to a link that ends with "url=" and it is tried first.
const SOURCES = [
  process.env.INSTA_API,
  'https://apis-keith.vercel.app/download/instagram?url=',
  'https://api.giftedtech.co.ke/api/download/instadl?apikey=gifted&url=',
  'https://api.siputzx.my.id/api/d/igdl?url='
].filter(Boolean)

export async function run({ sock, from, m, args, prefix, reply }) {
  const link = args[0]
  if (!link || !/^https?:\/\/(www\.)?instagram\.com\//i.test(link)) {
    return reply(box('INSTAGRAM', [`Use: ${prefix}ig https://www.instagram.com/reel/xxxx`]))
  }
  await reply(box('INSTAGRAM', ['Downloading, please wait... ⏳']))

  const got = await getMedia(SOURCES, link, 'instagram', ['video', 'image'])
  if (!got) return reply(box('INSTAGRAM', ['Could not download that right now. Make sure the account is public, then try again.']))

  const caption = box('INSTAGRAM', [['status', 'Downloaded ✅']])
  try {
    if (got.media.kind === 'video') {
      await sock.sendMessage(from, { video: got.buf, mimetype: got.media.mimetype, caption }, { quoted: m })
    } else {
      await sock.sendMessage(from, { image: got.buf, caption }, { quoted: m })
    }
  } catch (e) {
    console.log('instagram send failed:', e.message)
    await reply(box('INSTAGRAM', ['Downloaded, but sending failed. Try again.']))
  }
}
