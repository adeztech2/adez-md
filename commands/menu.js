import os from 'os'
import { getBotImage } from '../lib/botimage.js'

export const name = 'menu'
export const category = 'Main'
export const aliases = ['help', 'commands']
export const description = 'Numbered category menu (menu <number>)'

const ICONS = {
  ai: '🤖', download: '📥', fun: '🎉', general: '⚡', group: '👥',
  media: '🎞️', owner: '👑', tools: '🛠️', main: '🏠'
}

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
  const cats = Object.keys(groups).sort() // same order every time = stable numbers

  const input = (args?.[0] || '').toLowerCase()

  // .menu <number or name>  ->  commands in that category
  if (input) {
    const pick = /^\d+$/.test(input) ? cats[Number(input) - 1] : cats.find((c) => c === input)
    if (!pick) {
      return reply(`❌ No category "${input}".\nUse ${prefix}menu to see the numbers.`)
    }
    let text = `┌▣ ◈ *${ICONS[pick] || '📌'} ${pick.toUpperCase()} MENU* ◈\n`
    for (const c of groups[pick].sort((a, b) => a.name.localeCompare(b.name))) {
      text += `│ ➽ ${prefix}${c.name}\n│    _${c.description || 'no description'}_\n`
    }
    text += `└▣\n\n_Back to categories: ${prefix}menu_`
    return reply(text)
  }

  // .menu  ->  numbered categories
  const sent = Number(m?.messageTimestamp || 0) * 1000
  const speed = sent ? Math.max(0, Date.now() - sent) : 0
  const ram = ramBar()

  let text = `┌▣ ◈ *${botName}* ◈\n`
  text += `│ *OWNER* : Arnold Adez\n`
  text += `│ *PREFIX* : [ ${prefix} ]\n`
  text += `│ *HOST* : Render\n`
  text += `│ *PLUGINS* : ${all.length}\n`
  text += `│ *MODE* : Public\n`
  text += `│ *VERSION* : 1.0.0\n`
  text += `│ *SPEED* : ${speed} ms\n`
  text += `│ *USAGE* : ${ram.usage}\n`
  text += `│ *RAM* : ${ram.text}\n`
  text += `│ *UPTIME* : ${uptime()}\n`
  text += `└▣\n`

  text += `\n┌▣ ◈ *CATEGORIES* ◈\n`
  cats.forEach((cat, i) => {
    text += `│ *${i + 1}.* ${ICONS[cat] || '📌'} ${cat.toUpperCase()} (${groups[cat].length})\n`
  })
  text += `└▣\n`
  text += `\n_Reply to this message with a number (e.g. 1) to open that category_\n_Full list: ${prefix}menu2_`

  const image = getBotImage()
  if (image) {
    try {
      await sock.sendMessage(from, { image, caption: text }, { quoted: m })
      return
    } catch (e) {
      console.log('Menu image failed, sending text only:', e.message)
    }
  }
  await reply(text)
}
