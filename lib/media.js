import * as baileysNS from '@whiskeysockets/baileys'

const b = baileysNS.downloadMediaMessage ? baileysNS : (baileysNS.default ?? baileysNS)

// Finds the image/video/sticker in the message itself or in the message you replied to
export async function getMedia(sock, m) {
  const ctx = m.message?.extendedTextMessage?.contextInfo
  let msg = m
  if (ctx?.quotedMessage) {
    msg = {
      key: { remoteJid: m.key.remoteJid, id: ctx.stanzaId, participant: ctx.participant },
      message: ctx.quotedMessage
    }
  }

  let content = msg.message
  content =
    content?.viewOnceMessageV2?.message ||
    content?.viewOnceMessage?.message ||
    content?.viewOnceMessageV2Extension?.message ||
    content?.ephemeralMessage?.message ||
    content
  if (content !== msg.message) msg = { key: msg.key, message: content }

  const type = ['imageMessage', 'videoMessage', 'stickerMessage'].find((t) => content?.[t])
  if (!type) return null

  const buffer = await b.downloadMediaMessage(
    msg,
    'buffer',
    {},
    { reuploadRequest: sock.updateMediaMessage }
  )
  return { buffer, type, caption: content[type]?.caption || '' }
  }
