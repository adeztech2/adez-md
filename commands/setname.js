import { box } from '../lib/style.js'
import { groupGuard } from '../lib/guard.js'

export const name = 'setname'
export const category = 'group'
export const description = 'Change the group name'

export async function run(ctx) {
  const { sock, from, args, prefix, reply } = ctx
  const error = groupGuard('SETNAME', ctx)
  if (error) return reply(error)

  const text = args.join(' ').trim()
  if (!text) return reply(box('SETNAME', [['usage', `${prefix}setname <new name>`]]))

  try {
    await sock.groupUpdateSubject(from, text)
    await reply(box('SETNAME', [['new name', text], ['status', '✅ Done']]))
  } catch (e) {
    console.log('Setname failed:', e.message)
    await reply(box('SETNAME', ['Could not change the name.']))
  }
}
