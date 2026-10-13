import { box } from '../lib/style.js'

export const name = 'leave'
export const category = 'owner'
export const description = 'Make the bot leave this group'

export async function run({ sock, from, isGroup, isOwner, reply }) {
  if (!isOwner) return reply(box('LEAVE', ['⛔ Only the owner can use this.']))
  if (!isGroup) return reply(box('LEAVE', ['This works in groups only.']))

  await reply(box('LEAVE', [['status', 'Goodbye 👋']]))
  try {
    await sock.groupLeave(from)
  } catch (e) {
    console.log('Leave failed:', e.message)
  }
}
