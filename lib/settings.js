import { AsyncLocalStorage } from 'async_hooks'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
const OWNER_NUMBER = String(process.env.OWNER_NUMBER || '').replace(/\D/g, '')

// Every paired number has its own copy of each setting. Nothing is shared.
const DEFAULTS = {
  mode: 'public',
  autoreact: 'on',
  botname: 'ADEZ MD',
  prefix: process.env.PREFIX || '.',
  autobio: 'off',
  banned: '[]',
  anticall: 'on',
  chatbot: 'off',
  antidelete: 'off',
  antilink: 'off',
  antibot: 'off'
}

const userCache = new Map() // number -> { key: value }
const legacy = {}           // old shared rows from before this change (used once, for the owner)

// Remembers WHICH number's bot is handling the current message
const als = new AsyncLocalStorage()
export function runAs(number, fn) {
  return als.run(String(number || '') || null, fn)
}
const me = () => als.getStore() || null
const userKey = (n, k) => `u:${n}:${k}`

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
        legacy[row.key] = row.value
      }
    }
    // One-time: the owner keeps the old shared values so their settings don't reset
    if (OWNER_NUMBER) {
      const mine = userCache.get(OWNER_NUMBER) || {}
      for (const k of Object.keys(DEFAULTS)) {
        if (!(k in mine) && k in legacy) {
          mine[k] = legacy[k]
          const { error: e2 } = await supabase.from('bot_settings')
            .upsert({ key: userKey(OWNER_NUMBER, k), value: legacy[k] })
          if (e2) throw e2
        }
      }
      userCache.set(OWNER_NUMBER, mine)
    }
    console.log(`⚙️ Settings loaded for ${userCache.size} number(s)`)
  } catch (e) {
    console.log('⚠️ Could not load settings, using defaults:', e.message)
  }
}

// Outside a message (timers, startup), the owner's settings are used
export function getSetting(key) {
  const mine = userCache.get(me() || OWNER_NUMBER)
  if (mine && key in mine) return mine[key]
  return DEFAULTS[key]
}

export function getAllSettings() {
  return { ...DEFAULTS, ...(userCache.get(me() || OWNER_NUMBER) || {}) }
}

export async function setSetting(key, value) {
  const n = me() || OWNER_NUMBER
  if (!n) throw new Error('No number to save this setting for')
  const { error } = await supabase.from('bot_settings')
    .upsert({ key: userKey(n, key), value })
  if (error) throw error
  if (!userCache.has(n)) userCache.set(n, {})
  userCache.get(n)[key] = value
}
