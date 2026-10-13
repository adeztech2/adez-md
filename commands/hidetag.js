import { box } from '../lib/style.js'
import { groupGuard } from '../lib/guard.js'

export const name = 'hidetag'
export const category = 'group'
export const aliases = ['notify']
export const description = 'Notify everyone without listing names'

export async function run(ctx) {
  const { sock, from, m, args, prefix, groupMetadata, reply } = ctx
  const error = groupGuard('HIDETAG', ctx, false)
  if (error) return reply(error)

  const text = args.join(' ').trim()
  if (!text) return reply(box('HIDETAG', [['usage', `${prefix}hidetag <message>`]]))

  const ids = (groupMetadata?.participants || []).map((p) => p.id)
  await sock.sendMessage(from, { text, mentions: ids }, { quoted: m })
}
