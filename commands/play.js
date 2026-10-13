import yts from 'yt-search'
import axios from 'axios'
import { box } from '../lib/style.js'

export const name = 'play'
export const category = 'download'
export const aliases = ['music', 'song']
export const description = 'Download a song by name'

// Free download APIs, tried in order until one gives a real audio file.
// These public APIs come and go. To add your own, set PLAY_API in Render to a link
// that ends with "url=" (for example https://your-api.com/mp3?url=) and it is tried first.
const SOURCES = [
  process.env.PLAY_API,
  'https://apis-keith.vercel.app/download/dlmp3?url=',
  'https://api.giftedtech.co.ke/api/download/ytmp3?apikey=gifted&url=',
  'https://api.siputzx.my.id/api/d/ytmp3?url='
].filter(Boolean)

const MAX_SECONDS = 20 * 60 // skip very long videos
const KEYS = ['downloadUrl', 'download_url', 'dl', 'link', 'download', 'url']

// Different APIs name the download link differently, so look for it by several names
function search(obj, key, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 4) return null
  const v = obj[key]
  if (typeof v === 'string' && /^https?:\/\//.test(v) && !/youtu\.?be/.test(v)) return v
  for (const child of Object.values(obj)) {
    const found = search(child, key, depth + 1)
    if (found) return found
  }
  return null
}
function findLink(data) {
  for (const key of KEYS) {
    const hit = search(data, key)
    if (hit) return hit
  }
  return null
}

// Download the file ourselves so we can check it is real audio before sending
async function fetchAudio(link) {
  const res = await axios.get(link, {
    responseType: 'arraybuffer',
    timeout: 120000,
    maxContentLength: 80 * 1024 * 1024,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  })
  const buf = Buffer.from(res.data)
  if (buf.length < 50 * 1024) throw new Error('file too small')
  const head = buf.subarray(0, 16).toString('utf8').trimStart()
  if (head.startsWith('<') || head.startsWith('{')) throw new Error('not an audio file')
  return buf
}

// WhatsApp needs the right type or the message shows with no sound
function detectType(buf) {
  if (buf.subarray(0, 3).toString() === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) {
    return { mimetype: 'audio/mpeg', ext: 'mp3' }
  }
  if (buf.subarray(4, 8).toString() === 'ftyp') return { mimetype: 'audio/mp4', ext: 'm4a' }
  if (buf.subarray(0, 4).toString() === 'OggS') return { mimetype: 'audio/ogg; codecs=opus', ext: 'ogg' }
  return { mimetype: 'audio/mpeg', ext: 'mp3' }
}

async function getAudio(videoUrl) {
  for (let i = 0; i < SOURCES.length; i++) {
    try {
      const res = await axios.get(SOURCES[i] + encodeURIComponent(videoUrl), { timeout: 60000 })
      const link = findLink(res.data)
      if (!link) throw new Error('no download link in reply')
      return await fetchAudio(link)
    } catch (e) {
      console.log(`⚠️ play: source ${i + 1} failed: ${e.message}`)
    }
  }
  return null
}

export async function run({ sock, from, m, args, prefix, reply }) {
  const query = args.join(' ').trim()
  if (!query) return reply(`Usage: ${prefix}play <song name>`)

  try {
    const { videos } = await yts(query)
    if (!videos || videos.length === 0) return reply('No songs found.')

    const video = videos[0]
    if (video.seconds && video.seconds > MAX_SECONDS) {
      return reply('That video is too long. Try a shorter song.')
    }

    const info =
      box('MUSIC PLAYER', [
        ['title', video.title],
        ['artist', video.author?.name || 'Unknown'],
        ['duration', video.timestamp],
        ['views', video.views?.toLocaleString() || 'N/A'],
        ['uploaded', video.ago || 'N/A']
      ]) + `\n\n⏳ _Downloading, please wait..._`

    try {
      await sock.sendMessage(from, { image: { url: video.thumbnail }, caption: info }, { quoted: m })
    } catch {
      await reply(info)
    }

    const buf = await getAudio(video.url)
    if (!buf) return reply('❌ Could not get the audio right now. Please try again later.')

    const { mimetype, ext } = detectType(buf)
    const safeTitle = video.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 80) || 'song'
    await sock.sendMessage(
      from,
      { audio: buf, mimetype, fileName: `${safeTitle}.${ext}` },
      { quoted: m }
    )
  } catch (e) {
    console.log('Error in play command:', e)
    await reply('Download failed. Please try again later.')
  }
          }
