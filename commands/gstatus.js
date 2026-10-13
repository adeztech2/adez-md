import pino from 'pino'
import * as baileysNS from '@whiskeysockets/baileys'
import { box } from '../lib/style.js'

// Works with both Baileys builds (named exports or everything under .default)
const baileys = baileysNS.downloadMediaMessage ? baileysNS : (baileysNS.default ?? baileysNS)
const { downloadMediaMessage } = baileys
const logger = pino({ level: 'silent' })

export const name = 'gstatus'
export const category = 'owner'
export const aliases = ['groupstatus', 'togstatus']
export const description = 'Post a status that only members of this group can see'

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
  for (const type of ['imageMessage', 'videoMessage', 'audioMessage']) {
    if (x[type]) return { type, content: x[type] }
  }
  return null
}

// Status viewers must be listed by phone-number id
function phoneJid(p) {
  for (const c of [p.jid, p.phoneNumber, p.id]) {
    if (!c) continue
    const j = String(c).includes('@') ? String(c) : c + '@s.whatsapp.net'
    if (j.endsWith('@s.whatsapp.net')) return j
  }
  return null
}

export async function run(ctx) {
  const { sock, m, from, args, reply, isGroup, isOwner, groupMetadata, prefix } = ctx

  if (!isOwner) return reply('⛔ Owner only.')
  if (!isGroup) return reply('This command works in groups only.')
  if (!groupMetadata) return reply('⚠️ Could not read this group. Try again in a moment.')

  // Only the people in this group will be able to see the status
  const members = new Set()
  for (const p of groupMetadata.participants || []) {
    const j = phoneJid(p)
    if (j) members.add(j)
  }
  const me = String(sock.user?.id || '').split(':')[0].split('@')[0] + '@s.whatsapp.net'
  members.add(me)
  const statusJidList = [...members]

  // Find what to post: media (sent with the command or replied to) or text
  const mm = unwrap(m.message) || {}
  const info =
    mm.extendedTextMessage?.contextInfo ||
    mm.imageMessage?.contextInfo ||
    mm.videoMessage?.contextInfo
  const quoted = info?.quotedMessage
  const typedText = args.join(' ').trim()

  try {
    let media = findMedia(m.message)
    let target = m
    if (!media && quoted) {
      media = findMedia(quoted)
      target = {
        key: { remoteJid: from, id: info.stanzaId, fromMe: false, participant: info.participant },
        message: quoted
      }
    }

    let content
    let options = { statusJidList }

    if (media) {
      const buffer = await downloadMediaMessage(
        target,
        'buffer',
        {},
        { logger, reuploadRequest: sock.updateMediaMessage }
      )
      const caption = typedText || media.content.caption || ''
      if (media.type === 'imageMessage') content = { image: buffer, caption }
      else if (media.type === 'videoMessage') content = { video: buffer, caption }
      else content = { audio: buffer, mimetype: media.content.mimetype || 'audio/mp4', ptt: false }
    } else {
      const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text || ''
      const text = typedText || quotedText
      if (!text) {
        return reply(
          box('GROUP STATUS', [
            'Reply to an image, video, audio or text with',
            `${prefix}gstatus  to post it for this group`,
            `${prefix}gstatus your text  to post a text status`
          ])
        )
      }
      content = { text }
      options = { statusJidList, backgroundColor: '#075E54', font: 2 }
    }

    await sock.sendMessage('status@broadcast', content, options)
    return reply(
      box('GROUP STATUS', [
        ['status', 'Posted ✅'],
        ['visible to', `${statusJidList.length} members of this group`]
      ])
    )
  } catch (e) {
    console.log('gstatus error:', e.message)
    return reply('⚠️ Could not post the status: ' + e.message)
  }
}
