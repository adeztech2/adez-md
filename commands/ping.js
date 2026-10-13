export const name = 'ping'
export const category = 'general'
export const description = 'Check bot speed'

function uptime() {
  const s = Math.floor(process.uptime())
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${m}m`
}

export async function run({ m, reply }) {
  const botName = process.env.BOT_NAME || 'ADEZ MD'
  const sent = Number(m?.messageTimestamp || 0) * 1000
  const speed = sent ? Math.max(0, Date.now() - sent) : 0

  let text = `┌▣ ◈ *${botName} PING* ◈\n`
  text += `│ *SPEED* : ${speed} ms\n`
  text += `│ *STATUS* : Online ✅\n`
  text += `│ *UPTIME* : ${uptime()}\n`
  text += `└▣`

  await reply(text)
}
