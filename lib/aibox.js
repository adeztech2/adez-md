// ============================================================
//  lib/aibox.js - puts an AI answer INSIDE the box, so the side
//  bar runs down the whole reply (no question row).
//
//  Usage:  import { aiBox } from '../lib/aibox.js'
//          return reply(aiBox('ADEZ MD AI', answer))
// ============================================================

// wrap one line to `width` characters, breaking at spaces
function wrapLine(line, width) {
  if (line.length <= width) return [line]
  const out = []
  let cur = ''
  for (let word of line.split(' ')) {
    while (word.length > width) { // very long word (links etc.): cut it
      if (cur) { out.push(cur); cur = '' }
      out.push(word.slice(0, width))
      word = word.slice(width)
    }
    if (!cur) cur = word
    else if ((cur + ' ' + word).length <= width) cur += ' ' + word
    else { out.push(cur); cur = word }
  }
  if (cur) out.push(cur)
  return out
}

export function aiBox(title, text, width = 38) {
  const lines = String(text || '')
    .replace(/\r/g, '')
    .replace(/\*\*(.+?)\*\*/g, '*$1*') // AI bold -> WhatsApp bold
    .trim()
    .split('\n')

  const body = []
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) { body.push('│'); continue } // blank line keeps the bar
    for (const part of wrapLine(line, width)) body.push(`│ ${part}`)
  }

  return `┌▣ ◈ _${title}_ ◈\n${body.join('\n')}\n└▣`
}
