import os from 'os'
import { getSetting } from '../lib/settings.js'
import { box, noForward } from '../lib/style.js'

export const name = 'menu2'
export const category = 'Main'
export const aliases = ['fullmenu', 'allmenu']
export const description = 'Shows all commands'

// Order of the categories in the menu. Any new category you add later shows up after these.
const ORDER = ['general', 'download', 'ai', 'tools', 'fun', 'media', 'group', 'owner', 'main']

const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1).toLowerCase()

function uptime() {
  const s = Math.floor(process.uptime())
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${m}m`
}

function ramBar() {
  const used = process.memoryUsage().rss
  const total = os.totalmem()
  const pct = Math.min(100, Math.round((used / total) * 100))
  const filled = Math.round(pct / 10)
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled)
  const usedMb = Math.round(used / 1024 / 1024)
  const totalGb = (total / 1024 / 1024 / 1024).toFixed(0)
  return { text: `[${bar}] ${pct}%`, usage: `${usedMb} MB of ${totalGb} GB` }
}

export async function run({ sock, from, m, reply, prefix, getAllCommands }) {
  const botName = process.env.BOT_NAME || 'ADEZ MD'
  const all = getAllCommands()
  const groups = {}

  for (const cmd of all) {
    const cat = cap(cmd.category)
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(cmd.name)
  }

  // Put the categories in the order above (unknown ones go last, A to Z)
  const rank = (cat) => {
    const i = ORDER.indexOf(cat.toLowerCase())
    return i === -1 ? ORDER.length : i
  }
  const sortedCats = Object.keys(groups).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))

  const sent = Number(m?.messageTimestamp || 0) * 1000
  const speed = sent ? Math.max(0, Date.now() - sent) : 0
  const ram = ramBar()

  const info = box(botName, [
    ['owner', 'Arnold Adez'],
    ['prefix', `[ ${prefix} ]`],
    ['host', 'Render'],
    ['plugins', all.length],
    ['mode', cap(getSetting('mode') || 'public')],
    ['version', '1.0.0'],
    ['speed', `${speed} ms`],
    ['usage', ram.usage],
    ['ram', ram.text],
    ['uptime', uptime()]
  ])

  const sections = sortedCats.map((cat) =>
    box(`${cat.toUpperCase()} MENU`, groups[cat].sort())
  )

  const text = [info, ...sections].join('\n\n')

  const image = process.env.MENU_IMAGE
  if (image) {
    try {
      await sock.sendMessage(from, noForward({ image: { url: image }, caption: text }), { quoted: m })
      return
    } catch (e) {
      console.log('Menu image failed, sending text only:', e.message)
    }
  }

  await reply(text)
}
