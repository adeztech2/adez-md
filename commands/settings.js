import { getAllSettings, setSetting } from '../lib/settings.js'

export const name = 'settings'
export const category = 'owner'
export const aliases = ['setting', 'set']
export const description = 'View or change bot settings'

const RULES = {
  mode: ['public', 'private'],
  autoreact: ['on', 'off'],
  botname: null // any text
}

export async function run({ args, prefix, isOwner, reply }) {
  if (!isOwner) return reply('⛔ Only the owner can use this command.')

  const key = args[0]?.toLowerCase()
  const value = args.slice(1).join(' ').trim()

  if (!key) {
    const s = getAllSettings()
    let text = `┌▣ ◈ *SETTINGS* ◈\n`
    for (const k of Object.keys(RULES)) text += `│ *${k.toUpperCase()}* : ${s[k]}\n`
    text += `└▣\n\n`
    text += `_Change one:_\n`
    text += `${prefix}settings mode private\n`
    text += `${prefix}settings autoreact off\n`
    text += `${prefix}settings botname MY BOT`
    return reply(text)
  }

  if (!(key in RULES)) return reply(`Unknown setting "${key}". Type ${prefix}settings to see them.`)
  if (!value) return reply(`Give a value, for example: ${prefix}settings ${key} ${RULES[key] ? RULES[key][0] : 'MY BOT'}`)

  const clean = RULES[key] ? value.toLowerCase() : value
  if (RULES[key] && !RULES[key].includes(clean)) {
    return reply(`"${key}" only accepts: ${RULES[key].join(' or ')}`)
  }

  try {
    await setSetting(key, clean)
    await reply(`✅ *${key}* is now *${clean}*`)
  } catch (e) {
    console.log('Settings save failed:', e.message)
    await reply('⚠️ Could not save the setting. Check the Render logs.')
  }
}
