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
const cache = { ...DEFAULTS }

export async function loadSettings() {
  try {
    const { data, error } = await supabase.from('bot_settings').select('key, value')
    if (error) throw error
    for (const row of data) cache[row.key] = row.value
    console.log('⚙️ Settings loaded:', JSON.stringify(cache))
  } catch (e) {
    console.log('⚠️ Could not load settings, using defaults:', e.message)
  }
}

export function getSetting(key) {
  return cache[key] ?? DEFAULTS[key]
}

export function getAllSettings() {
  return { ...cache }
}

export async function setSetting(key, value) {
  const { error } = await supabase.from('bot_settings').upsert({ key, value })
  if (error) throw error
  cache[key] = value
}
