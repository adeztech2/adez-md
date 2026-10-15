// ============================================================
//  lib/botimage.js - one place that decides the bot picture
//  Pictures are OFF by default (they crashed the server with status 139).
//  Turn on later by setting BOT_IMAGE=on in Render.
//  Order when on: 1) MENU_IMAGE env  2) assets/bot.jpg  3) default link
// ============================================================
import fs from 'fs'
import path from 'path'

const DEFAULT_IMAGE = 'https://i.ibb.co/SX4Kqpst/upload-1791875972398-91102a3a-jpg.jpg'
const FILES = ['bot.jpg', 'bot.jpeg', 'bot.png', 'bot.webp']
let cached = null

export function getBotImage() {
  if (process.env.BOT_IMAGE !== 'on') return null // safe default: text only

  const link = process.env.MENU_IMAGE
  if (link) return { url: link }

  if (cached) return cached
  for (const f of FILES) {
    const p = path.resolve('assets', f)
    try {
      if (fs.existsSync(p)) {
        cached = fs.readFileSync(p)
        return cached
      }
    } catch {}
  }
  return DEFAULT_IMAGE ? { url: DEFAULT_IMAGE } : null
}
