import yts from 'yt-search'
import axios from 'axios'
import { box } from '../lib/style.js'

export const name = 'play'
export const category = 'download'
export const aliases = ['music', 'song']
export const description = 'Download a song by name or YouTube link'

// Free download APIs, tried in order until one gives a real audio file.
// These public APIs come and go. To add your own, set PLAY_API in Render to one or more
// links (separated by commas) that end with "url=", for example https://your-api.com/mp3?url=
// They are tried first.
const SOURCES = [
  ...String(process.env.PLAY_API || '').split(',').map((s) => s.trim()).filter(Boolean),
  'https://apis-keith.vercel.app/download/dlmp3?url=',
  'https://api.giftedtech.co.ke/api/download/ytmp3?apikey=gifted&url=',
  'https://api.siputzx.my.id/api/d/ytmp3?url=',
  'https://api.ryzendesu.vip/api/downloader/ytmp3?url=',
  'https://api.agatz.xyz/api/ytmp3?url='
]

const MAX_SECONDS = 20 * 60 // skip very long videos
const KEYS = ['downloadUrl', 'download_url', 'dl', 'link', 'download', 'url']
const YT_LINK = /^https?:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//i

// Different APIs name the download link differently, so look for it by several names
function search(obj, key, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 5) return null
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
    const host = SOURCES[i].split('/')[2]
    try {
      const res = await axios.get(SOURCES[i] + encodeURIComponent(videoUrl), { timeout: 30000 })
      const link = findLink(res.data)
      if (!link) throw new Error('no download link in reply')
      const buf = await fetchAudio(link)
      console.log(`✅ play: source ${i + 1} (${host}) worked`)
      return buf
    } catch (e) {
      console.log(`⚠️ play: source ${i + 1} (${host}) failed: ${e.message}`)
    }
  }
  return null
}

async function findVideo(query) {
  if (YT_LINK.test(query)) {
    const id = (query.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/) || [])[1]
    if (id) {
      try { return await yts({ videoId: id }) } catch {}
    }
  }
  const { videos } = await yts(query)
  return videos?.[0] || null
}

export async function run({ sock, from, m, args, prefix, reply }) {
  const query = args.join(' ').trim()
  if (!query) return reply(box('MUSIC PLAYER', [`Use: ${prefix}play <song name or YouTube link>`]))

  try {
    const video = await findVideo(query)
    if (!video) return reply(box('MUSIC PLAYER', ['No songs found.']))
    if (video.seconds && video.seconds > MAX_SECONDS) {
      return reply(box('MUSIC PLAYER', ['That video is too long. Try a shorter song.']))
    }

    const info =
      box('MUSIC PLAYER', [
        ['title', video.title],
        ['artist', video.author?.name || 'Unknown'],
        ['duration', video.timestamp || 'N/A'],
        ['views', video.views?.toLocaleString() || 'N/A'],
        ['uploaded', video.ago || 'N/A']
      ]) + `\n\n⏳ _Downloading, please wait..._`

    try {
      await sock.sendMessage(from, { image: { url: video.thumbnail || video.image }, caption: info }, { quoted: m })
    } catch {
      await reply(info)
    }

    const buf = await getAudio(video.url)
    if (!buf) {
      return reply(box('MUSIC PLAYER', [
        'Could not get the audio right now.',
        'The free download services may be down. Please try again later.'
      ]))
    }

    const { mimetype, ext } = detectType(buf)
    const safeTitle = video.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 80) || 'song'
    try {
      await sock.sendMessage(from, { audio: buf, mimetype, fileName: `${safeTitle}.${ext}` }, { quoted: m })
    } catch (e) {
      console.log('play: audio send failed, sending as a file:', e.message)
      await sock.sendMessage(from, { document: buf, mimetype, fileName: `${safeTitle}.${ext}` }, { quoted: m })
    }
  } catch (e) {
    console.log('Error in play command:', e)
    await reply(box('MUSIC PLAYER', ['Download failed. Please try again later.']))
  }
}
