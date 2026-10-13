// ============================================================
//  lib/channel.js  - makes each connected bot follow your WhatsApp channel
//  Already set to your channel below. Optional overrides in Render
//  (CHANNEL_FOLLOW=off turns auto-follow off):
//    CHANNEL_LINK = https://whatsapp.com/channel/XXXXXXXX   (easiest)
//    CHANNEL_JID  = 120363xxxxxxxxxx@newsletter
// ============================================================
import { getSetting, setSetting, runAs } from './settings.js'

const toNumber = (jid = '') => String(jid).split('@')[0].split(':')[0]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const CHANNEL_LINK = process.env.CHANNEL_LINK || 'https://whatsapp.com/channel/0029Vb8N0xYLikgHxdGh790m'
let cachedJid = process.env.CHANNEL_JID || null

async function resolveJid(sock) {
  if (cachedJid) return cachedJid
  const code = String(CHANNEL_LINK).split('/channel/')[1]?.split(/[/?#]/)[0]
  if (!code) return null
  const meta = await sock.newsletterMetadata('invite', code)
  cachedJid = meta?.id || null
  return cachedJid
}

export async function autoFollowChannel(sock) {
  if (process.env.CHANNEL_FOLLOW === 'off') return
  const who = toNumber(sock.user?.id)

  await runAs(who, async () => {
    if (getSetting('channel_followed') === 'yes') return // only once per person

    // Let the connection settle and spread out many bots connecting together
    await sleep(5000 + Math.floor(Math.random() * 15000))

    try {
      if (typeof sock.newsletterFollow !== 'function') {
        console.log('⚠️ channel: this Baileys version cannot follow channels. Update @whiskeysockets/baileys.')
        return
      }
      const jid = await resolveJid(sock)
      if (!jid) {
        console.log('⚠️ channel: could not find the channel. Check CHANNEL_LINK or CHANNEL_JID.')
        return
      }
      await sock.newsletterFollow(jid)
      await setSetting('channel_followed', 'yes')
      console.log(`📢 [${who}] Now following the channel`)
    } catch (e) {
      console.log(`⚠️ [${who}] channel follow failed: ${e.message}`)
    }
  })
}
