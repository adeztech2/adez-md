import { box } from '../lib/style.js'

export const name = 'groupinfo'
export const category = 'group'
export const aliases = ['ginfo', 'gc']
export const description = 'Show group details'

export async function run({ isGroup, groupMetadata, reply }) {
  if (!isGroup || !groupMetadata) return reply(box('GROUP INFO', ['This works in groups only.']))

  const members = groupMetadata.participants || []
  const admins = members.filter((p) => p.admin).length
  const created = groupMetadata.creation
    ? new Date(groupMetadata.creation * 1000).toLocaleDateString('en-GB')
    : 'Unknown'

  const rows = [
    ['name', groupMetadata.subject],
    ['members', members.length],
    ['admins', admins],
    ['created', created]
  ]
  if (groupMetadata.desc) rows.push(['about', String(groupMetadata.desc).slice(0, 200)])

  await reply(box('GROUP INFO', rows))
}
