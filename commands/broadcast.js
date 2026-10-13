import { box } from '../lib/style.js'

export const name = 'broadcast'
export const category = 'owner'
export const aliases = ['bc']
export const description = 'Send a message to all groups'

export async function run({ sock, args, prefix, isOwner, reply }) {
  if (!isOwner) return reply(box('BROADCAST', ['⛔ Only the owner can use this.']))

  const text = args.join(' ').trim()
  if (!text) return reply(box('BROADCAST', [['usage', `${prefix}broadcast <message>`]]))

  try {
    const groups = Object.keys(await sock.groupFetchAllParticipating())
    await reply(box('BROADCAST', [['groups', groups.length], ['status', 'Sending... ⏳']]))

    let sent = 0
    for (const id of groups) {
      try {
        await sock.sendMessage(id, { text: box('BROADCAST', [text]) })
        sent++
      } catch {}
      await new Promise((r) => setTimeout(r, 3000)) // slow and safe
    }
    await reply(box('BROADCAST', [['sent', `${sent} of ${groups.length}`], ['status', 'Done ✅']]))
  } catch (e) {
    console.log('Broadcast failed:', e.message)
    await reply(box('BROADCAST', ['Could not send the broadcast.']))
  }
}
