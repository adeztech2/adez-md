import { AsyncLocalStorage } from 'async_hooks'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

const DEFAULTS = {
  mode: 'public',
  autoreact: 'on',
  botname: 'ADEZ MD',
  prefix: process.env.PREFIX || '.',
  autobio: 'off',
  banned: '[]'
}
const cache = { ...DEFAULTS } // shared defaults (what everyone starts with)
const userCache = new Map() // number -> { key: value } (each person's own changes)

// Remembers WHICH person's bot is handling the current message, so getSetting() and
// setSetting() automatically use that person's own settings. Commands need no changes.
const als = new AsyncLocalStorage()
export function runAs(number, fn) {
  return als.run(String(number || '') || null, fn)
}
const me = () => als.getStore() || null
const userKey = (n, k) => `u:${n}:${k}` // how a personal setting is stored in bot_settings

export async function loadSettings() {
  try {
    const { data, error } = await supabase.from('bot_settings').select('key, value')
    if (error) throw error
    for (const row of data) {
      const m = /^u:(\d+):(.+)$/.exec(row.key)
      if (m) {
        if (!userCache.has(m[1])) userCache.set(m[1], {})
        userCache.get(m[1])[m[2]] = row.value
      } else {
        cache[row.key] = row.value
      }
    }
    console.log('⚙️ Settings loaded:', JSON.stringify(cache), `+ personal settings for ${userCache.size} user(s)`)
  } catch (e) {
    console.log('⚠️ Could not load settings, using defaults:', e.message)
  }
}

export function getSetting(key) {
  const mine = userCache.get(me())
  if (mine && key in mine) return mine[key]
  return cache[key] ?? DEFAULTS[key]
}

export function getAllSettings() {
  return { ...cache, ...(userCache.get(me()) || {}) }
}

export async function setSetting(key, value) {
  const n = me()
  if (n) {
    // Inside a person's message: save only for that person
    const { error } = await supabase.from('bot_settings').upsert({ key: userKey(n, key), value })
    if (error) throw error
    if (!userCache.has(n)) userCache.set(n, {})
    userCache.get(n)[key] = value
    return
  }
  const { error } = await supabase.from('bot_settings').upsert({ key, value })
  if (error) throw error
  cache[key] = value
                           }
