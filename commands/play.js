import yts from 'yt-search'
import axios from 'axios'

export const name = 'play'
export const category = 'download'
export const aliases = ['music', 'song']
export const description = 'Download a song by name'

export async function run({ sock, from, m, args, prefix, reply }) {
  const query = args.join(' ').trim()
  if (!query) return reply(`Usage: ${prefix}play <song name>`)

  try {
    const { videos } = await yts(query)
    if (!videos || videos.length === 0) return reply('No songs found.')

    const video = videos[0]

    let info = `┌▣ ◈ *MUSIC PLAYER* ◈\n`
    info += `│ *TITLE* : ${video.title}\n`
    info += `│ *ARTIST* : ${video.author?.name || 'Unknown'}\n`
    info += `│ *DURATION* : ${video.timestamp}\n`
    info += `│ *VIEWS* : ${video.views?.toLocaleString() || 'N/A'}\n`
    info += `│ *UPLOADED* : ${video.ago || 'N/A'}\n`
    info += `└▣\n\n`
    info += `⏳ _Downloading, please wait..._`

    try {
      await sock.sendMessage(from, { image: { url: video.thumbnail }, caption: info }, { quoted: m })
    } catch {
      await reply(info)
    }

    const res = await axios.get(
      `https://apis-keith.vercel.app/download/dlmp3?url=${video.url}`,
      { timeout: 60000 }
    )
    const data = res.data
    if (!data?.status || !data?.result?.downloadUrl) {
      return reply('Failed to fetch audio. Please try again later.')
    }

    await sock.sendMessage(
      from,
      {
        audio: { url: data.result.downloadUrl },
        mimetype: 'audio/mpeg',
        fileName: `${data.result.title || video.title}.mp3`
      },
      { quoted: m }
    )
  } catch (e) {
    console.log('Error in play command:', e)
    await reply('Download failed. Please try again later.')
  }
}
