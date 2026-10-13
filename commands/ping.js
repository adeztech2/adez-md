export const name = 'ping'
export const category = 'Main'
export const description = 'Checks if the bot is alive'

export async function run({ reply, m }) {
  const start = Date.now()
  const ms = Date.now() - (Number(m.messageTimestamp) * 1000 || start)
  await reply(`🏓 Pong! I'm alive.\nSpeed: ${Math.abs(ms)}ms`)
}
