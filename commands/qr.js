import QRCode from 'qrcode'
import { box } from '../lib/style.js'

export const name = 'qr'
export const category = 'tools'
export const aliases = ['qrcode']
export const description = 'Make a QR code: .qr any text or link'

export async function run({ sock, m, from, args, reply, prefix }) {
  const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage
  const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text || ''
  const text = args.join(' ') || quotedText
  if (!text) return reply(box('QR CODE', [`Use: ${prefix}qr https://example.com`, `Or reply to a message with: ${prefix}qr`]))
  if (text.length > 500) return reply(box('QR CODE', ['That text is too long. Keep it under 500 characters.']))

  try {
    const buffer = await QRCode.toBuffer(text, { width: 512, margin: 2 })
    await sock.sendMessage(from, { image: buffer, caption: box('QR CODE', [['content', text.length > 60 ? text.slice(0, 60) + '...' : text]]) }, { quoted: m })
  } catch (e) {
    console.log('qr failed:', e.message)
    await reply(box('QR CODE', ['Could not make the QR code. Try again.']))
  }
}
