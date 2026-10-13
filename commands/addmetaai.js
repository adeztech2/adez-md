import { box } from '../lib/style.js'
import { groupGuard } from '../lib/guard.js'

export const name = 'addmetaai'
export const category = 'group'
export const description = 'Try to add Meta AI to this group'

const META_AI = '13135550002@s.whatsapp.net'

export async function run(ctx) {
  const { sock, from, reply } = ctx
  const error = groupGuard('META AI', ctx)
  if (error) return reply(error)

  try {
    const res = await sock.groupParticipantsUpdate(from, [META_AI], 'add')
    const status = String(res?.[0]?.status || '')
    if (status === '200') {
      await reply(box('META AI', [['status', 'Added ✅']]))
    } else {
      await reply(box('META AI', [['status', `WhatsApp refused (code ${status || 'unknown'})`]]))
    }
  } catch (e) {
    console.log('Addmetaai failed:', e.message)
    await reply(box('META AI', ['Could not add Meta AI.']))
  }
}
