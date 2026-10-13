export const name = 'autoreact'

const EMOJI = '⚡'

export async function run(ctx) {
  const { sock, m, from, text, prefix, getAllCommands } = ctx

  if (!text || !text.startsWith(prefix)) return

  const word = text.slice(prefix.length).trim().split(/\s+/)[0]?.toLowerCase()
  if (!word) return

  const isCommand = getAllCommands().some(
    (c) => c.name === word || c.aliases.map((a) => String(a).toLowerCase()).includes(word)
  )
  if (!isCommand) return

  try {
    await sock.sendMessage(from, { react: { text: EMOJI, key: m.key } })
  } catch (e) {
    console.log('Auto react failed:', e.message)
  }
}
