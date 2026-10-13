import yts from 'yt-search'
import axios from 'axios'
import { box, botName } from '../lib/style.js'

export const name = 'video'
export const category = 'download'
export const aliases = ['ytmp4']
export const description = 'Download a YouTube video'

export async function run({ sock, from, m, args, prefix, reply }) {
  const title = `${botName()} VIDEO`
  const query = args.join(' ').trim()
  if (!query) return reply(box(title, [['usage', `${prefix}video <name>`]]))

  try {
    const { videos } = await yts(query)
    if (!videos?.length) return reply(box(title, ['No videos found.']))
    const video = videos[0]

    await reply(box(title, [
      ['title', video.title],
      ['duration', video.timestamp],
      ['status', 'Downloading... ⏳']
    ]))

    const { data } = await axios.get(
      `https://apis-keith.vercel.app/download/dlmp4?url=${video.url}`,
      { timeout: 90000 }
    )
    const link = data?.result?.downloadUrl || data?.result?.url
    if (!data?.status || !link) return reply(box(title, ['Failed to fetch the video.']))

    await sock.sendMessage(from, {
      video: { url: link },
      mimetype: 'video/mp4',
      caption: video.title
    }, { quoted: m })
  } catch (e) {
    console.log('Video failed:', e.message)
    await reply(box(title, ['Download failed. Try again later.']))
  }
}
