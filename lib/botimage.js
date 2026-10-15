// ============================================================
//  lib/botimage.js - one place that decides the bot picture
//  Order: 1) MENU_IMAGE env in Render (a direct image link)
//         2) a file in the project: assets/bot.jpg (.jpeg .png .webp)
//         3) the default link below
// ============================================================
import fs from 'fs'
import path from 'path'

const DEFAULT_IMAGE = 'https://i.ibb.co/SX4Kqpst/upload-1791875972398-91102a3a-jpg.jpg'
const FILES = ['bot.jpg', 'bot.jpeg', 'bot.png', 'bot.webp']
let cached = null

export function getBotImage() {
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
