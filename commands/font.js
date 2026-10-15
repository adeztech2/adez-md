import { box } from '../lib/style.js'

export const name = 'font'
export const category = 'tools'
export const aliases = ['fonts', 'style']
export const description = 'Fancy text styles: .font Hello  |  .font 3 Hello'

// Builds a converter from the start of the capital letters, small letters and digits
// in a Unicode block. "ex" fixes the letters Unicode placed somewhere else.
function make({ upper, lower, digit, ex = {} }) {
  return (text) =>
    [...text].map((ch) => {
      if (ex[ch]) return ex[ch]
      const c = ch.charCodeAt(0)
      if (upper && c >= 65 && c <= 90) return String.fromCodePoint(upper + c - 65)
      if (lower && c >= 97 && c <= 122) return String.fromCodePoint(lower + c - 97)
      if (digit && c >= 48 && c <= 57) return String.fromCodePoint(digit + c - 48)
      return ch
    }).join('')
}

const SMALL = 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ'
const smallCaps = (text) =>
  [...text].map((ch) => {
    const c = ch.toLowerCase().charCodeAt(0)
    return c >= 97 && c <= 122 ? SMALL[c - 97] : ch
  }).join('')

const circled = (text) =>
  [...text].map((ch) => {
    const c = ch.charCodeAt(0)
    if (c >= 65 && c <= 90) return String.fromCodePoint(0x24b6 + c - 65)
    if (c >= 97 && c <= 122) return String.fromCodePoint(0x24d0 + c - 97)
    if (c === 48) return '⓪'
    if (c >= 49 && c <= 57) return String.fromCodePoint(0x2460 + c - 49)
    return ch
  }).join('')

export const STYLES = [
  ['Bold', make({ upper: 0x1d400, lower: 0x1d41a, digit: 0x1d7ce })],
  ['Italic', make({ upper: 0x1d434, lower: 0x1d44e, ex: { h: 'ℎ' } })],
  ['Bold Italic', make({ upper: 0x1d468, lower: 0x1d482 })],
  ['Script', make({ upper: 0x1d49c, lower: 0x1d4b6, ex: { B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ', e: 'ℯ', g: 'ℊ', o: 'ℴ' } })],
  ['Bold Script', make({ upper: 0x1d4d0, lower: 0x1d4ea })],
  ['Gothic', make({ upper: 0x1d504, lower: 0x1d51e, ex: { C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ' } })],
  ['Double Struck', make({ upper: 0x1d538, lower: 0x1d552, digit: 0x1d7d8, ex: { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' } })],
  ['Sans Bold', make({ upper: 0x1d5d4, lower: 0x1d5ee, digit: 0x1d7ec })],
  ['Monospace', make({ upper: 0x1d670, lower: 0x1d68a, digit: 0x1d7f6 })],
  ['Small Caps', smallCaps],
  ['Circled', circled]
]

export async function run({ m, args, reply, prefix }) {
  const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage
  const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text || ''

  // ".font 3 Hello" picks one style, ".font Hello" shows them all
  const pick = /^\d{1,2}$/.test(args[0] || '') ? parseInt(args[0], 10) : 0
  const text = (pick ? args.slice(1) : args).join(' ') || quotedText

  if (!text) {
    return reply(box('FONT', [
      `Use: ${prefix}font Hello - see every style`,
      `Use: ${prefix}font 3 Hello - one style only`,
      `Or reply to a message with ${prefix}font`
    ]))
  }
  if (text.length > 200) return reply(box('FONT', ['Keep the text under 200 characters.']))

  if (pick) {
    const style = STYLES[pick - 1]
    if (!style) return reply(box('FONT', [`Pick a style from 1 to ${STYLES.length}.`]))
    return reply(box('FONT', [['style', style[0]], ['text', style[1](text)]]))
  }
  return reply(box('FONT', STYLES.map(([label, fn], i) => `${i + 1}. ${fn(text)}`)))
}
