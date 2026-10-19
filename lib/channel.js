// ============================================================
//  lib/channel.js - auto-follow + forwarded-from-channel look
//  Optional overrides in Render:
//    CHANNEL_FOLLOW=off   turns auto-follow off
//    CHANNEL_LINK = https://whatsapp.com/channel/XXXXXXXX
//    CHANNEL_JID  = 120363xxxxxxxxxx@newsletter
//    CHANNEL_NAME = ADEZ TECH
// ============================================================
import { getSetting, setSetting, runAs } from './settings.js'

const toNumber = (jid = '') => String(jid).split('@')[0].split(':')[0]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const CHANNEL_LINK = process.env.CHANNEL_LINK || 'https://whatsapp.com/channel/0029Vb8N0xYLikgHxdGh790m'
export const CHANNEL_NAME = process.env.CHANNEL_NAME || 'ADEZ TECH'
let cachedJid = process.env.CHANNEL_JID || null

// Numbers currently running the follow routine (stops double calls)
const running = new Set()

async function resolveJid(sock) {
  if (cachedJid) return cachedJid
  const code = String(CHANNEL_LINK).split('/channel/')[1]?.split(/[/?#]/)[0]
  if (!code) return null
  const meta = await sock.newsletterMetadata('invite', code)
  cachedJid = meta?.id || null
  return cachedJid
}

export const getChannelJid = () => cachedJid

// Use inside sendMessage: { text, contextInfo: channelContext() }
export function channelContext() {
  if (!cachedJid) return {}
  return {
    isForwarded: true,
    forwardingScore: 999,
    forwardedNewsletterMessageInfo: {
      newsletterJid: cachedJid,
      newsletterName: CHANNEL_NAME,
      serverMessageId: 100
    }
  }
}

export async function autoFollowChannel(sock) {
  // Always load the JID first so forwarding works even if already followed
  try { await resolveJid(sock) } catch (e) {
    console.log('⚠️ channel: resolve failed:', e.message)
  }

  if (process.env.CHANNEL_FOLLOW === 'off') return
  const who = toNumber(sock.user?.id)
  if (running.has(who)) return
  running.add(who)

  try {
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
        const msg = String(e?.message || '')
        if (/unexpected response|already/i.test(msg)) {
          // Baileys can't parse WhatsApp's reply, but the follow normally went through
          await setSetting('channel_followed', 'yes')
          console.log(`📢 [${who}] Follow response unreadable, treating as followed`)
        } else {
          console.log(`⚠️ [${who}] channel follow failed: ${msg}`)
        }
      }
    })
  } finally {
    running.delete(who)
  }
}

// ------------------------------------------------------------
//  Channel label on EVERY reply the bot sends.
//  index.js calls installChannelForward(sock) once for each connection.
// ------------------------------------------------------------
// Kinds of message that can carry the channel label
const FORWARD_KINDS = ['text', 'image', 'video', 'audio', 'document', 'sticker', 'contacts', 'location']
// Kinds that must be left exactly as they are
const FORWARD_SKIP = ['delete', 'react', 'edit', 'forward', 'poll', 'disappearingMessagesInChat']

let lookupFailedAt = 0 // when the channel lookup last failed, so we do not retry on every message
let lookupPending = null

async function ensureJid(sock) {
  if (cachedJid) return cachedJid
  if (Date.now() - lookupFailedAt < 10 * 60 * 1000) return null
  if (!lookupPending) {
    const timeout = new Promise((_, no) => setTimeout(() => no(new Error('took too long')), 8000))
    lookupPending = Promise.race([resolveJid(sock), timeout])
      .then((jid) => { if (!jid) lookupFailedAt = Date.now() })
      .catch((e) => {
        lookupFailedAt = Date.now()
        console.log('⚠️ channel: lookup failed:', e.message)
      })
      .finally(() => { lookupPending = null })
  }
  await lookupPending
  return cachedJid
}

export function installChannelForward(sock) {
  const send = sock.sendMessage.bind(sock)

  sock.sendMessage = async (to, content, options) => {
    try {
      const canCarry = content && FORWARD_KINDS.some((k) => content[k] !== undefined && content[k] !== null)
      const mustSkip = content && FORWARD_SKIP.some((k) => content[k] !== undefined && content[k] !== null)
      const alreadyChannel = content?.contextInfo?.forwardedNewsletterMessageInfo
      if (canCarry && !mustSkip && !alreadyChannel && to !== 'status@broadcast' && !String(to).endsWith('@newsletter')) {
        if (await ensureJid(sock)) {
          content = { ...content, contextInfo: { ...(content.contextInfo || {}), ...channelContext() } }
        }
      }
    } catch {}
    return send(to, content, options)
  }
}
