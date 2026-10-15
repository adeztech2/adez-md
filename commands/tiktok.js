import { box } from '../lib/style.js'
import { getMedia } from '../lib/downloader.js'

export const name = 'tiktok'
export const category = 'download'
export const aliases = ['tt']
export const description = 'Download a TikTok video: .tiktok <link>'

// Free APIs, tried in order. They come and go. To add your own, set TIKTOK_API in Render
// to a link that ends with "url=" and it is tried first.
const SOURCES = [
  process.env.TIKTOK_API,
  'https://apis-keith.vercel.app/download/tiktok?url=',
  'https://api.giftedtech.co.ke/api/download/tiktok?apikey=gifted&url=',
  'https://api.siputzx.my.id/api/d/tiktok?url='
].filter(Boolean)

export async function run({ sock, from, m, args, prefix, reply }) {
  const link = args[0]
  if (!link || !/^https?:\/\/(www\.|vm\.|vt\.|m\.)?tiktok\.com\//i.test(link)) {
    return reply(box('TIKTOK', [`Use: ${prefix}tiktok https://vm.tiktok.com/xxxx`]))
  }
  await reply(box('TIKTOK', ['Downloading, please wait... ⏳']))

  const got = await getMedia(SOURCES, link, 'tiktok', ['video'])
  if (!got) return reply(box('TIKTOK', ['Could not download that video right now. Try again later.']))

  try {
    await sock.sendMessage(from, {
      video: got.buf,
      mimetype: got.media.mimetype,
      caption: box('TIKTOK', [['status', 'Downloaded ✅']])
    }, { quoted: m })
  } catch (e) {
    console.log('tiktok send failed:', e.message)
    await reply(box('TIKTOK', ['Downloaded, but sending failed. Try again.']))
  }
}
