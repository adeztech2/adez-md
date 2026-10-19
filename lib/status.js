// ============================================================
//  lib/status.js - auto-view and auto-like WhatsApp statuses
//  Set in Render/Heroku:
//    AUTO_READ_STATUS=true   view every status
//    AUTO_LIKE_STATUS=true   react to every status
// ============================================================

const READ = String(process.env.AUTO_READ_STATUS || 'false').toLowerCase() === 'true'
const LIKE = String(process.env.AUTO_LIKE_STATUS || 'false').toLowerCase() === 'true'
const EMOJIS = ['💚', '❤️', '🔥', '👏', '😍', '🙌']

const pick = () => EMOJIS[Math.floor(Math.random() * EMOJIS.length)]

export async function handleStatus(sock, m) {
  if (m?.key?.remoteJid !== 'status@broadcast' || m.key.fromMe) return
  if (!READ && !LIKE) return

  try {
    if (READ) await sock.readMessages([m.key])
  } catch (e) {
    console.log('Status view failed:', e.message)
  }

  if (LIKE) {
    try {
      await sock.sendMessage(
        'status@broadcast',
        { react: { text: pick(), key: m.key } },
        { statusJidList: [m.key.participant].filter(Boolean) }
      )
    } catch (e) {
      console.log('Status like failed:', e.message)
    }
  }
}
