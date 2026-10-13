import { getMedia } from '../lib/media.js'
import { box } from '../lib/style.js'

export const name = 'tostatus'
export const category = 'owner'
export const aliases = ['poststatus']
export const description = 'Post an image, video or text to the bot status'

export async function run({ sock, m, args, prefix, isOwner, isGroup, groupMetadata, resolveJid, reply }) {
  if (!isOwner) return reply(box('STATUS', ['⛔ Only the owner can use this.']))

  const text = args.join(' ').trim()
  let media = null
  try { media = await getMedia(sock, m) } catch {}

  if (!media && !text) {
    return reply(box('STATUS', [
      ['usage', `${prefix}tostatus <text>`],
      'Or reply to an image or video'
    ]))
  }

  const botJid = String(sock.user.id).split(':')[0].split('@')[0] + '@s.whatsapp.net'
  const viewers = new Set([botJid])
  if (isGroup) {
    for (const p of groupMetadata?.participants || []) {
      const jid = resolveJid(p.phoneNumber || p.id)
      if (String(jid).endsWith('@s.whatsapp.net')) viewers.add(jid)
    }
  }

  let content
  if (media?.type === 'imageMessage') content = { image: media.buffer, caption: text || media.caption }
  else if (media?.type === 'videoMessage') content = { video: media.buffer, caption: text || media.caption }
  else content = { text, backgroundColor: '#128C7E', font: 1 }

  try {
    await sock.sendMessage('status@broadcast', content, { statusJidList: [...viewers] })
    await reply(box('STATUS', [['status', 'Posted ✅'], ['viewers', viewers.size]]))
  } catch (e) {
    console.log('Tostatus failed:', e.message)
    await reply(box('STATUS', ['Could not post the status.']))
  }
}
