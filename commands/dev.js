import fs from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'
import { box, noForward } from '../lib/style.js'

export const name = 'dev'
export const category = 'owner'
export const description = 'Download a zip of the bot source (owner only)'

const OWNER = String(process.env.OWNER_NUMBER || '').replace(/\D/g, '')
const EXCLUDE = new Set(['node_modules', 'sessions', '.git'])

// Adds every file under dir to the zip, skipping excluded folders and .env files
function addFolder(dir, base, zip) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE.has(entry.name) || entry.name.startsWith('.env')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      addFolder(full, base, zip)
    } else if (entry.isFile()) {
      const folder = path.relative(base, path.dirname(full))
      zip.addLocalFile(full, folder)
    }
  }
}

export async function run({ sock, from, m, reply }) {
  const senderNum = String(m?.key?.participant || m?.key?.remoteJid || '')
    .split('@')[0].split(':')[0].replace(/\D/g, '')
  const isOwner = m?.key?.fromMe || (OWNER && senderNum === OWNER)

  if (!isOwner) {
    return reply(box('DEV', [['status', 'Owner only ❌']]))
  }

  const botName = process.env.BOT_NAME || 'ADEZ MD'
  const root = path.resolve(process.cwd())
  const stamp = new Date().toISOString().slice(0, 10)
  const fileName = `${botName.replace(/[^\w-]+/g, '_')}-${stamp}.zip`

  try {
    await reply(box('DEV', [['status', 'Building zip...']]))

    const zip = new AdmZip()
    addFolder(root, root, zip)
    const buffer = zip.toBuffer()

    await sock.sendMessage(from, noForward({
      document: buffer,
      mimetype: 'application/zip',
      fileName,
      caption: box('DEV', [
        ['file', fileName],
        ['size', `${Math.round(buffer.length / 1024)} KB`]
      ])
    }), { quoted: m })
  } catch (e) {
    console.log('Dev zip failed:', e.message)
    await reply(box('DEV', [['status', `Failed: ${e.message}`]]))
  }
}
