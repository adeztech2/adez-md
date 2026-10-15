import os from 'os'
import { getBotImage } from '../lib/botimage.js'
import { box, noForward } from '../lib/style.js'
import { getSetting } from '../lib/settings.js'

export const name = 'menu'
export const category = 'Main'
export const aliases = ['help', 'commands']
export const description = 'Numbered category menu (menu <number>)'

const ICONS = {
  ai: '🤖', download: '📥', fun: '🎉', general: '⚡', group: '👥',
  media: '🎞️', owner: '👑', tools: '🛠️', main: '🏠'
}

// Order of the categories (this sets the numbers 1, 2, 3...).
// Any new category you add later goes after these, A to Z.
const ORDER = ['general', 'download', 'ai', 'tools', 'fun', 'media', 'group', 'owner', 'main']

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

export async function run({ sock, from, m, args, reply, prefix, getAllCommands }) {
  const botName = process.env.BOT_NAME || 'ADEZ MD'
  const all = getAllCommands()

  const groups = {}
  for (const cmd of all) {
    const cat = String(cmd.category || 'other').toLowerCase()
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(cmd)
  }
  // Same order every time = stable numbers
  const rank = (c) => {
    const i = ORDER.indexOf(c)
    return i === -1 ? ORDER.length : i
  }
  const cats = Object.keys(groups).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))

  const input = (args?.[0] || '').toLowerCase()

  // .menu <number or name>  ->  command names only in that category
  if (input) {
    const pick = /^\d+$/.test(input) ? cats[Number(input) - 1] : cats.find((c) => c === input)
    if (!pick) {
      return reply(`❌ No category "${input}".\nUse ${prefix}menu to see the numbers.`)
    }
    const rows = groups[pick]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => `${prefix}${c.name}`)
    const text = box(`${ICONS[pick] || '📌'} ${pick.toUpperCase()} MENU`, rows) + `\n\n_Back to categories: ${prefix}menu_`
    return reply(text)
  }

  // .menu  ->  numbered categories
  const sent = Number(m?.messageTimestamp || 0) * 1000
  const speed = sent ? Math.max(0, Date.now() - sent) : 0
  const ram = ramBar()
  const mode = String(getSetting('mode') || 'public')

  const info = box(botName, [
    ['owner', 'Arnold Adez'],
    ['prefix', `[ ${prefix} ]`],
    ['host', 'Render'],
    ['plugins', all.length],
    ['mode', mode.charAt(0).toUpperCase() + mode.slice(1)],
    ['version', '1.0.0'],
    ['speed', `${speed} ms`],
    ['usage', ram.usage],
    ['ram', ram.text],
    ['uptime', uptime()]
  ])

  const catList = cats.map((cat, i) => `${i + 1}. ${ICONS[cat] || '📌'} ${cat.toUpperCase()} (${groups[cat].length})`)
  const categories = box('CATEGORIES', catList)

  let text = `${info}\n\n${categories}`
  text += `\n\n_Reply to this message with a number (e.g. 1) to open that category_\n_Full list: ${prefix}menu2_`

  const image = getBotImage()
  if (image) {
    try {
      await sock.sendMessage(from, noForward({ image, caption: text }), { quoted: m })
      return
    } catch (e) {
      console.log('Menu image failed, sending text only:', e.message)
    }
  }
  await reply(text)
}
