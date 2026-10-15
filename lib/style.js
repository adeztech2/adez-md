export const botName = () => process.env.BOT_NAME || 'ADEZ MD'

// Font for box titles. Set BOT_FONT in Render to: italic | bold | smallcaps | mono | normal
const BOT_FONT = (process.env.BOT_FONT || 'italic').toLowerCase()

const SMALL_CAPS = {
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ',
  k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 'ꜱ', t: 'ᴛ',
  u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ'
}

// Maps A-Z and a-z to a Unicode block. Other characters stay as they are.
function mapLetters(text, upperStart, lowerStart) {
  return Array.from(text, (ch) => {
    const c = ch.charCodeAt(0)
    if (c >= 65 && c <= 90) return String.fromCodePoint(upperStart + c - 65)
    if (c >= 97 && c <= 122) return String.fromCodePoint(lowerStart + c - 97)
    return ch
  }).join('')
}

const BOLD = (t) => mapLetters(t, 0x1d400, 0x1d41a)
const MONO = (t) => mapLetters(t, 0x1d670, 0x1d68a)
// Italic h is a gap in the Unicode block, so it uses ℎ instead
const ITALIC = (t) => Array.from(t, (ch) => (ch === 'h' ? 'ℎ' : mapLetters(ch, 0x1d434, 0x1d44e))).join('')
const SMALL = (t) => Array.from(t.toLowerCase(), (ch) => SMALL_CAPS[ch] ?? ch).join('')

// Returns the title in the chosen font
export function styleTitle(text) {
  const t = String(text)
  switch (BOT_FONT) {
    case 'normal':    return `*${t}*`
    case 'smallcaps': return `*${SMALL(t)}*`
    case 'mono':      return `*${MONO(t)}*`
    case 'bold':      return BOLD(t)
    default:          return ITALIC(t)
  }
}

// rows: ['text'] gives "➽ text", [['key','value']] gives "KEY : value"
export function box(title, rows = []) {
  let t = `┌▣ ◈ ${styleTitle(title)} ◈\n`
  for (const r of rows) {
    if (Array.isArray(r)) t += `│ *${String(r[0]).toUpperCase()}* : ${r[1]}\n`
    else t += `│ ➽ ${r}\n`
  }
  return t + `└▣`
}

// Sends text, with the menu picture on top if MENU_IMAGE is set
export async function sendCard({ sock, from, m, reply }, text) {
  const image = process.env.MENU_IMAGE
  if (image) {
    try {
      await sock.sendMessage(from, { image: { url: image }, caption: text }, { quoted: m })
      return
    } catch (e) {
      console.log('Card image failed, sending text only:', e.message)
    }
  }
  await reply(text)
}
