// ============================================================
//  lib/autoreact.js - auto react to incoming messages
//  1) When a message is a COMMAND (e.g. .chatbot), react with that
//     command's emoji, or its category emoji (ai 🤖, download 📥 ...)
//  2) Everything else gets a random emoji (any from the list below,
//     or your own list set with .autoreact emojis)
//  Settings (saved per connected number):
//    autoreact         on / off
//    autoreact_cmds    on / off   (command + category emojis, default on)
//    autoreact_emojis  JSON list for normal messages
//    autoreact_status  on / off   (react to contacts' statuses)
// ============================================================
import { getSetting } from './settings.js'

export const DEFAULT_EMOJIS = [
  '❤️', '😂', '🔥', '👍', '😍', '🙏', '💯', '🎉', '😎', '✨', '🥰', '😁', '🤩', '👏', '💪',
  '🙌', '😊', '🤝', '💙', '💚', '💛', '🧡', '💜', '🌟', '⚡', '🚀', '👌', '😇', '🤗', '🫶',
  '😆', '🥳', '😋', '🤭', '👀', '💫', '🌈', '🍀', '🎯', '🏆'
]

// Emoji per CATEGORY (used when the command has no emoji of its own)
export const CATEGORY_EMOJIS = {
  ai: '🤖', download: '📥', fun: '🎉', general: '⚡', group: '👥',
  main: '🏠', media: '🎞️', owner: '👑', tools: '🛠️'
}

// Emoji per COMMAND (overrides the category). Add your own here.
export const COMMAND_EMOJIS = {
  chatbot: '🤖', ping: '🏓', menu: '📜', menu2: '📜', play: '🎵', video: '🎬',
  tiktok: '🎶', instagram: '📸', sticker: '🖼️', weather: '🌦️', time: '🕒',
  calc: '🧮', qr: '🔳', translate: '🌍', define: '📖', imagine: '🎨',
  antilink: '🔗', antibot: '🚫', antidelete: '🗑️', kick: '🦵', ban: '⛔',
  warn: '⚠️', tagall: '📣', hidetag: '👻', autoreact: '😀', alive: '💚'
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pick = (list) => list[Math.floor(Math.random() * list.length)]

export function getEmojis() {
  try {
    const list = JSON.parse(getSetting('autoreact_emojis') || '[]')
    if (Array.isArray(list) && list.length) return list
  } catch {}
  return DEFAULT_EMOJIS
}

function textOf(msg) {
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    ''
  ).trim()
}

// returns the emoji for a command message, or null if it isn't a command
function commandEmoji(msg, getAllCommands) {
  const prefix = getSetting('prefix') || '.'
  const text = textOf(msg)
  if (!text.startsWith(prefix)) return null
  const word = text.slice(prefix.length).trim().split(/\s+/)[0]?.toLowerCase()
  if (!word) return null
  const cmd = getAllCommands().find((c) => c.name === word || c.aliases?.includes(word))
  if (!cmd) return null
  return (
    COMMAND_EMOJIS[cmd.name] ||
    CATEGORY_EMOJIS[String(cmd.category || '').toLowerCase()] ||
    null
  )
}

export async function autoReact(sock, m, getAllCommands) {
  if (getSetting('autoreact') !== 'on') return

  const key = m?.key
  const msg = m?.message
  if (!key?.id || !msg) return

  const jid = key.remoteJid || ''
  if (jid.endsWith('@newsletter')) return

  // skip reactions, deletes and other system messages
  if (msg.reactionMessage || msg.protocolMessage || msg.pollUpdateMessage) return

  // skip old messages (history sync, reconnects)
  const ts = Number(m.messageTimestamp || 0)
  if (ts && Date.now() / 1000 - ts > 60) return

  const isStatus = jid === 'status@broadcast'
  if (isStatus && getSetting('autoreact_status') !== 'on') return

  // command messages get their command/category emoji (also from your own phone)
  let emoji = null
  if (!isStatus && getSetting('autoreact_cmds') !== 'off') {
    try { emoji = commandEmoji(msg, getAllCommands) } catch {}
  }

  // normal messages: only other people's, never your own
  if (!emoji) {
    if (key.fromMe) return
    emoji = pick(getEmojis())
  }

  await sleep(500 + Math.floor(Math.random() * 1500)) // look human

  const react = { react: { text: emoji, key } }
  try {
    if (isStatus) {
      const me = String(sock.user?.id || '').split(':')[0].split('@')[0] + '@s.whatsapp.net'
      const poster = key.participant
      if (!poster) return
      await sock.sendMessage('status@broadcast', react, { statusJidList: [poster, me] })
    } else {
      await sock.sendMessage(jid, react)
    }
  } catch (e) {
    console.log('⚠️ autoreact failed:', e.message)
  }
                                }
