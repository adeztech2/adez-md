// Reconnects ONLY the bot of the person who sent the command (other users stay online)
export const name = 'restart'
export const category = 'owner'
export const aliases = ['reboot']
export const description = 'Reconnect your bot'

export async function run({ sock, reply, isOwner }) {
  if (!isOwner) return reply('⛔ Owner only.')
  await reply('🔄 Reconnecting your bot...')
  const ok = globalThis.__adez?.restartSession(sock)
  if (!ok) await reply('⚠️ Could not restart your session.')
}
