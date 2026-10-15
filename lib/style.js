import { box, botName, sendCard } from '../lib/style.js'
import { getSetting } from '../lib/settings.js'

export const name = 'menu'
export const category = 'Main'
export const aliases = ['help', 'commands']
export const description = 'Show all commands: .menu  |  .menu group'

// Order and icon of each section. New categories you add later still show up (at the end).
const SECTIONS = [
  ['general', '🏠', 'GENERAL'],
  ['ai', '🤖', 'AI'],
  ['download', '📥', 'DOWNLOADS'],
  ['media', '🎨', 'MEDIA'],
  ['tools', '🛠️', 'TOOLS'],
  ['fun', '🎉', 'FUN'],
  ['group', '👥', 'GROUP'],
  ['owner', '👑', 'OWNER']
]

const uptime = () => {
  const s = Math.floor(process.uptime())
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  return d ? `${d}d ${h}h ${m}m` : h ? `${h}h ${m}m` : `${m}m`
}

export async function run(ctx) {
  const { reply, prefix, getAllCommands } = ctx
  const all = getAllCommands().filter((c) => String(c.category).toLowerCase() !== 'main')

  // Group commands by category
  const groups = new Map()
  for (const c of all) {
    const key = String(c.category).toLowerCase()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(c)
  }
  for (const list of groups.values()) list.sort((a, b) => a.name.localeCompare(b.name))

  // Ordered list of [key, icon, label]
  const known = new Set(SECTIONS.map((s) => s[0]))
  const order = [
    ...SECTIONS.filter((s) => groups.has(s[0])),
    ...[...groups.keys()].filter((k) => !known.has(k)).sort().map((k) => [k, '📌', k.toUpperCase()])
  ]

  // ".menu group" shows one section with what each command does
  const ask = (ctx.args[0] || '').toLowerCase()
  if (ask) {
    const sec = order.find((s) => s[0] === ask || s[2].toLowerCase() === ask)
    if (!sec) {
      return reply(box('MENU', [`No section called "${ask}".`, `Sections: ${order.map((s) => s[0]).join(', ')}`]))
    }
    const rows = groups.get(sec[0]).map((c) => `${prefix}${c.name}${c.description ? ' - ' + c.description : ''}`)
    return reply(box(`${sec[1]} ${sec[2]}`, rows))
  }

  const head = box(`${botName()}`, [
    ['owner', 'Arnold Adez'],
    ['prefix', `[ ${prefix} ]`],
    ['mode', getSetting('mode') || 'public'],
    ['commands', all.length],
    ['uptime', uptime()],
    ['time', new Date().toLocaleTimeString('en-GB', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit' })]
  ])

  // One command per line, going down
  const sections = order.map(([key, icon, label]) =>
    box(`${icon} ${label}`, groups.get(key).map((c) => prefix + c.name))
  )

  const text = [head, ...sections, `_Tip: ${prefix}menu group shows what each group command does_`].join('\n\n')
  await sendCard(ctx, text)
}
