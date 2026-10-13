export const name = 'menu'
export const category = 'Main'
export const aliases = ['help', 'commands']
export const description = 'Shows all commands'

const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1).toLowerCase()

function uptime() {
  const s = Math.floor(process.uptime())
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${m}m`
}

export async function run({ reply, prefix, getAllCommands, isOwner }) {
  const botName = process.env.BOT_NAME || 'ADEZ MD'
  const all = getAllCommands()
  const groups = {}

  for (const cmd of all) {
    const cat = cap(cmd.category)
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(cmd.name)
  }

  let text = `┏━━━━━━━━━━━━━━━━━━┓\n`
  text += `┃  ✦ *${botName}* ✦\n`
  text += `┣━━━━━━━━━━━━━━━━━━┫\n`
  text += `┃ ◈ Prefix   ➜ ${prefix}\n`
  text += `┃ ◈ Owner    ➜ Arnold Adez\n`
  text += `┃ ◈ Commands ➜ ${all.length}\n`
  text += `┃ ◈ Uptime   ➜ ${uptime()}\n`
  text += `┃ ◈ Mode     ➜ ${isOwner ? 'Owner' : 'User'}\n`
  text += `┗━━━━━━━━━━━━━━━━━━┛\n`

  for (const [cat, names] of Object.entries(groups)) {
    text += `\n╭──『 *${cat.toUpperCase()}* 』\n`
    for (const n of names.sort()) {
      text += `│ ➤ ${prefix}${n}\n`
    }
    text += `╰──────────────\n`
  }

  text += `\n_Type ${prefix}<command> to use it_`

  await reply(text)
}
