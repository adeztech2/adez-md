export const name = 'menu'
export const category = 'Main'
export const aliases = ['help', 'commands']
export const description = 'Shows all commands'

export async function run({ reply, prefix, getAllCommands }) {
  const botName = process.env.BOT_NAME || 'ADEZ MD'
  const groups = {}

  for (const cmd of getAllCommands()) {
    if (!groups[cmd.category]) groups[cmd.category] = []
    groups[cmd.category].push(cmd.name)
  }

  let text = `╭━━━ *${botName}* ━━━╮\n`
  text += `│ Prefix: ${prefix}\n`
  text += `│ Owner: Arnold Adez\n`
  text += `╰━━━━━━━━━━━━━━╯\n`

  for (const [cat, names] of Object.entries(groups)) {
    text += `\n*${cat}*\n`
    text += names.map((n) => `• ${prefix}${n}`).join('\n') + '\n'
  }

  await reply(text)
}
