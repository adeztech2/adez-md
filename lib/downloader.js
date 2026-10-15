import axios from 'axios'

// Different APIs name the media link differently, so we look for several names
const KEYS = ['nowm', 'no_watermark', 'hdplay', 'play', 'video_url', 'video', 'downloadUrl', 'download_url', 'dl', 'link', 'download', 'url']
const PAGE_LINK = /tiktok\.com\/@|tiktok\.com\/t\/|instagram\.com\/(p|reel|reels|tv)\//i

function walk(obj, pairs, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 5) return
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && /^https?:\/\//.test(v)) pairs.push([k, v])
    else if (v && typeof v === 'object') walk(v, pairs, depth + 1)
  }
}

export function candidateLinks(data) {
  const pairs = []
  walk(data, pairs)
  const out = []
  for (const key of KEYS) {
    for (const [k, v] of pairs) {
      if (k === key && !PAGE_LINK.test(v) && !out.includes(v)) out.push(v)
    }
  }
  return out.slice(0, 6)
}

// Look at the first bytes of the file to see what it really is
export function detectMedia(buf) {
  const b = buf
  if (b.subarray(4, 8).toString() === 'ftyp') return { kind: 'video', mimetype: 'video/mp4' }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { kind: 'video', mimetype: 'video/webm' }
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: 'image', mimetype: 'image/jpeg' }
  if (b[0] === 0x89 && b.subarray(1, 4).toString() === 'PNG') return { kind: 'image', mimetype: 'image/png' }
  if (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return { kind: 'image', mimetype: 'image/webp' }
  return null
}

async function fetchFile(link) {
  const res = await axios.get(link, {
    responseType: 'arraybuffer',
    timeout: 120000,
    maxContentLength: 60 * 1024 * 1024,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  })
  const buf = Buffer.from(res.data)
  if (buf.length < 10 * 1024) throw new Error('file too small')
  return buf
}

// Try each API in order. Returns { buf, media } or null.
export async function getMedia(sources, pageUrl, label, accept = ['video', 'image']) {
  for (let i = 0; i < sources.length; i++) {
    try {
      const res = await axios.get(sources[i] + encodeURIComponent(pageUrl), { timeout: 60000 })
      const links = candidateLinks(res.data)
      if (!links.length) throw new Error('no download link in reply')
      for (const link of links) {
        try {
          const buf = await fetchFile(link)
          const media = detectMedia(buf)
          if (media && accept.includes(media.kind)) return { buf, media }
        } catch {}
      }
      throw new Error('no usable file found')
    } catch (e) {
      console.log(`⚠️ ${label}: source ${i + 1} failed: ${e.message}`)
    }
  }
  return null
      }
