import { box } from '../lib/style.js'
import { groupGuard } from '../lib/guard.js'

export const name = 'setdesc'
export const category = 'group'
export const description = 'Change the group description'

export async function run(ctx) {
  const { sock, from, args, prefix, reply } = ctx
  const error = groupGuard('SETDESC', ctx)
  if (error) return reply(error)

  const text = args.join(' ').trim()
  if (!text) return reply(box('SETDESC', [['usage', `${prefix}setdesc <new description>`]]))

  try {
    await sock.groupUpdateDescription(from, text)
    await reply(box('SETDESC', [['status', 'Description updated ✅']]))
  } catch (e) {
    console.log('Setdesc failed:', e.message)
    await reply(box('SETDESC', ['Could not change the description.']))
  }
}
