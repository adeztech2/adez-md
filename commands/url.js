import pino from 'pino'
import * as baileysNS from '@whiskeysockets/baileys'
import { box } from '../lib/style.js'

// Works with both Baileys builds (named exports or everything under .default)
const baileys = baileysNS.downloadMediaMessage ? baileysNS : (baileysNS.default ?? baileysNS)
const { downloadMediaMessage } = baileys
const logger = pino({ level: 'silent' })

export const name = 'url'
export const category = 'tools'
export const aliases = ['tourl']
export const description = 'Reply to media to get a link, or send a link to shorten it'

const MEDIA_TYPES = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage']
const EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a',
  'application/pdf': 'pdf'
}
const URL_RE = /https?:\/\/[^\s]+/i

function unwrap(msg) {
  let x = msg
  while (x) {
    const inner =
      x.ephemeralMessage?.message ||
      x.viewOnceMessage?.message ||
      x.viewOnceMessageV2?.message ||
      x.documentWithCaptionMessage?.message
    if (!inner) break
    x = inner
  }
  return x
}

function findMedia(msg) {
  const x = unwrap(msg)
  if (!x) return null
  const type = MEDIA_TYPES.find((t) => x[t])
  return type ? { type, content: x[type] } : null
}

const fmtSize = (n) => (n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`)

async function timedFetch(url, opts = {}, ms = 60000) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    return await fetch(url, { ...opts, signal: ctl.signal })
  } finally {
    clearTimeout(t)
  }
}

async function uploadCatbox(buffer, filename, mime) {
  const form = new FormData()
  form.append('reqtype', 'fileupload')
  form.append('fileToUpload', new Blob([buffer], { type: mime }), filename)
  const res = await timedFetch('https://catbox.moe/user/api.php', { method: 'POST', body: form })
  const text = (await res.text()).trim()
  if (!res.ok || !/^https?:\/\//.test(text)) throw new Error('catbox: ' + text.slice(0, 80))
  return text
}

async function upload0x0(buffer, filename, mime) {
  const form = new FormData()
  form.append('file', new Blob([buffer], { type: mime }), filename)
  const res = await timedFetch('https://0x0.st', {
    method: 'POST',
    headers: { 'User-Agent': 'adez-md-bot/1.0' },
    body: form
  })
  const text = (await res.text()).trim()
  if (!res.ok || !/^https?:\/\//.test(text)) throw new Error('0x0: ' + text.slice(0, 80))
  return text
}

async function shorten(link) {
  const tries = [
    `https://is.gd/create.php?format=simple&url=${encodeURIComponent(link)}`,
    `https://tinyurl.com/api-create.php?url=${encodeURIComponent(link)}`
  ]
  for (const api of tries) {
    try {
      const res = await timedFetch(api, {}, 15000)
      const text = (await res.text()).trim()
      if (res.ok && /^https?:\/\//.test(text)) return text
    } catch {}
  }
  throw new Error('Could not shorten that link')
}

export async function run(ctx) {
  const { sock, m, from, args, reply, prefix } = ctx

  const mm = unwrap(m.message) || {}
  const info =
    mm.extendedTextMessage?.contextInfo ||
    mm.imageMessage?.contextInfo ||
    mm.videoMessage?.contextInfo ||
    mm.documentMessage?.contextInfo
  const quoted = info?.quotedMessage

  try {
    // 1) A link was typed: shorten it
    const typed = args.join(' ').match(URL_RE)
    if (typed) {
      const short = await shorten(typed[0])
      return reply(box('SHORT LINK', [['link', short]]))
    }

    // 2) Media: sent with the command as caption, or replied to
    let media = findMedia(m.message)
    let target = m
    if (!media && quoted) {
      media = findMedia(quoted)
      target = {
        key: { remoteJid: from, id: info.stanzaId, fromMe: false, participant: info.participant },
        message: quoted
      }
    }

    if (media) {
      const buffer = await downloadMediaMessage(
        target,
        'buffer',
        {},
        { logger, reuploadRequest: sock.updateMediaMessage }
      )
      const mime = media.content.mimetype || 'application/octet-stream'
      const ext = EXT[mime.split(';')[0]] || mime.split('/')[1]?.split(';')[0] || 'bin'
      const filename = media.content.fileName || `file.${ext}`

      let link
      try {
        link = await uploadCatbox(buffer, filename, mime)
      } catch (e1) {
        console.log('⚠️ url: catbox failed, trying 0x0.st -', e1.message)
        link = await upload0x0(buffer, filename, mime)
      }
      return reply(box('MEDIA LINK', [['link', link], ['size', fmtSize(buffer.length)]]))
    }

    // 3) Replied to a text that contains a link: shorten it
    const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text || ''
    const quotedLink = quotedText.match(URL_RE)
    if (quotedLink) {
      const short = await shorten(quotedLink[0])
      return reply(box('SHORT LINK', [['link', short]]))
    }

    // Nothing usable: show help
    return reply(
      box('URL', [
        'Reply to an image, video, audio or file with',
        `${prefix}url  to get a link for it`,
        `${prefix}url https://long-link  to shorten a link`
      ])
    )
  } catch (e) {
    console.log('❌ url command error:', e.message)
    return reply('⚠️ Could not do that: ' + e.message)
  }
      }
        
