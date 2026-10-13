import { box } from '../lib/style.js'

export const name = 'getpp'
export const category = 'media'
export const aliases = ['pp']
export const description = 'Get a profile picture'

export async function run({ sock, from, m, sender, resolveJid, reply }) {
  const ctx = m.message?.extendedTextMessage?.contextInfo
  const target = resolveJid(ctx?.mentionedJid?.[0] || ctx?.participant || sender)

  try {
    const url = await sock.profilePictureUrl(target, 'image')
    await sock.sendMessage(
      from,
      { image: { url }, caption: box('PROFILE', [['number', target.split('@')[0]]]) },
      { quoted: m }
    )
  } catch {
    await reply(box('PROFILE', ['No profile picture found (it may be hidden).']))
  }
}
