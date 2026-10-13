// ============================================================
//  ADEZ MD - index.js  (MULTI-SESSION: owner + up to MAX_SESSIONS users)
//  Each person pairs their own WhatsApp number from /pair.html.
//  Sessions are stored in Supabase table bu_sessions (id, data):
//    id = 'session'          -> the main/owner login (same as before)
//    id = 'user_<number>'    -> one row per extra person
// ============================================================
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import http from 'http'
import express from 'express'
import { Server } from 'socket.io'
import pino from 'pino'
import QRCode from 'qrcode'
import AdmZip from 'adm-zip'
import { createClient } from '@supabase/supabase-js'
import * as baileysNS from '@whiskeysockets/baileys'
const baileys = baileysNS.useMultiFileAuthState ? baileysNS : (baileysNS.default ?? baileysNS)
const makeWASocket =
  baileysNS.makeWASocket ||
  (typeof baileysNS.default === 'function' ? baileysNS.default : baileysNS.default?.default) ||
  baileys.makeWASocket
const {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} = baileys
import { loadCommands, loadObservers, handleMessage, getAllCommands } from './lib/router.js'
import { registerEvents } from './lib/events.js'
import { box } from './lib/style.js'
import { loadSettings, getSetting } from './lib/settings.js'
import { startAutoBio } from './lib/autobio.js'

// ---------- Quiet the encryption log spam ----------
const NOISE_PREFIXES = [
  'Closing session',
  'Closing open session',
  'Failed to decrypt message with any known session',
  'Session error:',
  'Bad MAC',
  'Decrypted message with closed session',
  'Removing old closed session'
]
let noiseCount = 0
for (const fn of ['log', 'info', 'warn', 'error']) {
  const orig = console[fn].bind(console)
  console[fn] = (...args) => {
    if (typeof args[0] === 'string' && NOISE_PREFIXES.some((p) => args[0].startsWith(p))) {
      noiseCount++
      return
    }
    orig(...args)
  }
}
setInterval(() => {
  if (noiseCount > 0) {
    console.log(`ℹ️ Hid ${noiseCount} encryption log lines in the last minute`)
    noiseCount = 0
  }
}, 60 * 1000).unref()

// ---------- Settings ----------
const BOT_NAME = process.env.BOT_NAME || 'ADEZ MD'
const PORT = process.env.PORT || 3000
const MAIN_ID = 'session'
const SESSIONS_ROOT = path.resolve('./sessions')
const OWNER_NUMBER = String(process.env.OWNER_NUMBER || '').replace(/\D/g, '') // owner's own number
const MAX_SESSIONS = Number(process.env.MAX_SESSIONS || 20) // includes the main session
const STAGGER_MS = Number(process.env.STAGGER_MS || 4000) // gap between connections at startup
const PAIR_TIMEOUT_MS = 3 * 60 * 1000 // give up if a new person does not finish pairing
const SYNC_INTERVAL = 2 * 60 * 1000
const START_DELAY_MS = Number(process.env.START_DELAY_MS ?? (process.env.RENDER ? 15000 : 0))

const logger = pino({ level: 'silent' })
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------- Express web server + Socket.IO ----------
const app = express()
const server = http.createServer(app)
const io = new Server(server)

/** id -> session state */
const sessions = new Map()

function makeState(id, opts = {}) {
  return {
    id,
    isMain: id === MAIN_ID,
    dir: path.join(SESSIONS_ROOT, id),
    sock: null,
    status: 'starting',
    restored: !!opts.skipRestore,
    live: false, // true only if this login really worked
    starting: false,
    startTimer: null,
    pendingSave: Promise.resolve(),
    lastSync: 0,
    syncTimer: null,
    syncInterval: null,
    pairTimeout: null,
    welcomeSent: false,
    pairNumber: opts.pairNumber || null,
    pairClient: opts.pairClient || null,
    pairAsked: false,
    lastQR: null,
    removed: false,
    msgCache: new Map()
  }
}

function cacheMessage(s, m) {
  if (!m?.key?.id || !m.message) return
  s.msgCache.set(m.key.id, m.message)
  if (s.msgCache.size > 300) s.msgCache.delete(s.msgCache.keys().next().value)
}

// Main session talks to everyone on the page; user sessions only talk to the person who asked
// The pair page switches to the "Bot connected" screen when it receives 'connected'.
// The main bot is almost always connected, so visitors must never receive that for it,
// otherwise the pair form would be hidden for everyone. They see "Ready to link" instead.
const publicMainStatus = (st) => (st === 'connected' ? 'waiting_for_scan' : st)

function emitTo(s, event, payload) {
  if (s.isMain) io.emit(event, event === 'status' ? publicMainStatus(payload) : payload)
  else if (s.pairClient) io.to(s.pairClient).emit(event, payload)
}

function connectedCount() {
  let n = 0
  for (const s of sessions.values()) if (s.status === 'connected') n++
  return n
}

app.get('/', (req, res) => {
  const main = sessions.get(MAIN_ID)
  res.json({
    status: 'ok',
    bot: BOT_NAME,
    connection: main?.status || 'starting',
    sessions: sessions.size,
    connected: connectedCount(),
    max: MAX_SESSIONS,
    uptime: Math.floor(process.uptime())
  })
})
app.use(express.static('public', { index: false }))

io.on('connection', (client) => {
  const main = sessions.get(MAIN_ID)
  client.emit('status', publicMainStatus(main?.status || 'starting'))
  if (main?.lastQR) client.emit('qr', main.lastQR)

  // Anyone can pair their own number: it becomes its own session
  client.on('requestPair', async (number) => {
    try {
      const clean = String(number || '').replace(/\D/g, '')
      if (clean.length < 8) return client.emit('pairError', 'Enter your number with country code')

      // The owner re-links the MAIN login here (set OWNER_NUMBER in Render, digits only)
      const main = sessions.get(MAIN_ID)
      if (OWNER_NUMBER && clean === OWNER_NUMBER && main) {
        if (main.status === 'connected') return client.emit('pairError', 'Already connected')
        if (!main.sock || main.status !== 'waiting_for_scan') {
          return client.emit('pairError', 'Bot not ready yet, wait a few seconds and try again')
        }
        main.pairClient = client.id
        const code = await main.sock.requestPairingCode(clean)
        return client.emit('pairCode', code)
      }

      const id = 'user_' + clean
      const existing = sessions.get(id)
      if (existing) {
        if (existing.status === 'connected') return client.emit('pairError', 'This number is already connected')
        return client.emit('pairError', 'Pairing for this number is already in progress, wait a few minutes')
      }
      if (sessions.size >= MAX_SESSIONS) {
        return client.emit('pairError', 'Bot is full right now. Contact the owner.')
      }

      const s = makeState(id, { skipRestore: true, pairNumber: clean, pairClient: client.id })
      fs.rmSync(s.dir, { recursive: true, force: true }) // always a clean start
      sessions.set(id, s)
      s.pairTimeout = setTimeout(() => {
        if (s.status !== 'connected' && !s.removed) {
          emitTo(s, 'pairError', 'Pairing timed out. Try again.')
          removeSession(s, 'pairing timed out')
        }
      }, PAIR_TIMEOUT_MS)

      await startSession(s)
    } catch (e) {
      client.emit('pairError', 'Failed: ' + e.message)
    }
  })
})

// ---------- Supabase session sync (one row per session) ----------
async function restoreSession(s) {
  try {
    const { data, error } = await supabase.from('bu_sessions').select('data').eq('id', s.id).maybeSingle()
    if (error) throw error
    if (data?.data) {
      fs.rmSync(s.dir, { recursive: true, force: true })
      fs.mkdirSync(s.dir, { recursive: true })
      new AdmZip(Buffer.from(data.data, 'base64')).extractAllTo(s.dir, true)
      s.live = true
      console.log(`✅ [${s.id}] Session restored from Supabase`)
    } else {
      console.log(`ℹ️ [${s.id}] No saved session in Supabase`)
    }
  } catch (e) {
    console.log(`⚠️ [${s.id}] Could not restore session:`, e.message)
  }
}

async function uploadSession(s) {
  try {
    if (s.removed || s.status !== 'connected') return // never save half-finished logins
    if (!fs.existsSync(s.dir)) return
    await s.pendingSave
    const zip = new AdmZip()
    zip.addLocalFolder(s.dir)
    const base64 = zip.toBuffer().toString('base64')
    const { error } = await supabase.from('bu_sessions').upsert({ id: s.id, data: base64 })
    if (error) throw error
    s.lastSync = Date.now()
    console.log(`☁️ [${s.id}] Session saved to Supabase`)
  } catch (e) {
    console.log(`⚠️ [${s.id}] Session upload failed:`, e.message)
  }
}

function scheduleSync(s) {
  if (s.syncTimer || s.removed) return
  const wait = Math.max(0, SYNC_INTERVAL - (Date.now() - s.lastSync))
  s.syncTimer = setTimeout(async () => {
    s.syncTimer = null
    await uploadSession(s)
  }, wait)
}

async function clearSavedSession(s) {
  fs.rmSync(s.dir, { recursive: true, force: true })
  try { await supabase.from('bu_sessions').delete().eq('id', s.id) } catch {}
}

// ---------- Keep ONE socket alive per session ----------
function stopSocket(s) {
  if (!s.sock) return
  const old = s.sock
  s.sock = null
  try { old.ev.removeAllListeners() } catch {}
  try { old.end(undefined) } catch {}
}

function scheduleStart(s, ms) {
  if (s.removed) return
  if (s.startTimer) clearTimeout(s.startTimer)
  s.startTimer = setTimeout(() => {
    s.startTimer = null
    startSession(s).catch((e) => {
      console.log(`❌ [${s.id}] start failed:`, e.message)
      scheduleStart(s, 5000)
    })
  }, ms)
}

// Fully remove a user session (memory, files and Supabase row)
async function removeSession(s, reason) {
  if (s.removed) return
  s.removed = true
  console.log(`🗑️ [${s.id}] Removed: ${reason}`)
  for (const t of [s.startTimer, s.syncTimer, s.pairTimeout]) if (t) clearTimeout(t)
  if (s.syncInterval) clearInterval(s.syncInterval)
  stopSocket(s)
  sessions.delete(s.id)
  await clearSavedSession(s)
}

// ---------- Start one WhatsApp connection ----------
async function startSession(s) {
  if (s.starting || s.removed) return
  s.starting = true
  try {
    stopSocket(s)
    await s.pendingSave

    if (!s.restored) {
      await restoreSession(s)
      s.restored = true
    }

    const { state, saveCreds } = await useMultiFileAuthState(s.dir)
    const { version } = await fetchLatestBaileysVersion()

    const thisSock = makeWASocket({
      version,
      auth: state,
      logger,
      browser: Browsers.ubuntu('Chrome'),
      printQRInTerminal: false,
      syncFullHistory: false,
      fireInitQueries: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      getMessage: async (key) => s.msgCache.get(key?.id)
    })
    s.sock = thisSock
    registerEvents(thisSock)

    thisSock.ev.on('creds.update', () => {
      s.pendingSave = s.pendingSave
        .then(() => saveCreds())
        .catch((e) => console.log(`⚠️ [${s.id}] saveCreds failed:`, e.message))
      scheduleSync(s)
    })

    thisSock.ev.on('connection.update', async (update) => {
      if (thisSock !== s.sock || s.removed) return // ignore events from an old socket
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        if (s.isMain) {
          s.lastQR = await QRCode.toDataURL(qr)
          s.status = 'waiting_for_scan'
          io.emit('qr', s.lastQR)
          io.emit('status', publicMainStatus(s.status))
          console.log('📱 QR ready - open /pair.html to scan')
        } else {
          // A user session: the socket is ready, so ask for the pairing code now
          if (s.pairNumber && !s.pairAsked) {
            s.pairAsked = true
            s.status = 'waiting_for_scan'
            try {
              const code = await thisSock.requestPairingCode(s.pairNumber)
              emitTo(s, 'pairCode', code)
              console.log(`🔑 [${s.id}] Pairing code sent`)
            } catch (e) {
              emitTo(s, 'pairError', 'Failed: ' + e.message)
              removeSession(s, 'could not get pairing code')
            }
          } else if (!s.pairNumber) {
            // Saved login is no longer valid and there is nobody to pair it
            removeSession(s, 'saved login expired')
          }
        }
      }

      if (connection === 'open') {
        s.lastQR = null
        s.status = 'connected'
        s.live = true
        if (s.pairTimeout) { clearTimeout(s.pairTimeout); s.pairTimeout = null }
        emitTo(s, 'status', s.status)
        // The owner who just re-linked the main login sees the success screen
        if (s.isMain && s.pairClient) io.to(s.pairClient).emit('status', 'connected')
        console.log(`✅ [${s.id}] ${BOT_NAME} connected! (${connectedCount()}/${sessions.size})`)
        if (s.isMain) startAutoBio(thisSock)
        uploadSession(s)

        // Save whenever any key file changed (spread out so sessions do not zip all at once)
        if (!s.syncInterval) {
          s.syncInterval = setInterval(() => {
            if (s.status !== 'connected') return
            try {
              const changed = fs
                .readdirSync(s.dir)
                .some((f) => fs.statSync(path.join(s.dir, f)).mtimeMs > s.lastSync)
              if (changed) uploadSession(s)
            } catch {}
          }, SYNC_INTERVAL + Math.floor(Math.random() * 30000))
        }

        // Connected alert, sent to the number the session is linked with
        if (!s.welcomeSent) {
          s.welcomeSent = true
          const prefix = getSetting('prefix') || '.'
          const jid = String(thisSock.user?.id || '').split(':')[0].split('@')[0] + '@s.whatsapp.net'
          const alert = box(`${BOT_NAME} LINKED`, [
            ['status', 'Connected successfully ✅'],
            ['owner', s.isMain ? 'Arnold Adez' : 'You'],
            ['prefix', `[ ${prefix} ]`],
            ['plugins', getAllCommands().length],
            ['time', new Date().toLocaleString('en-GB', { timeZone: 'Africa/Nairobi' })]
          ]) + `\n\n_Type ${prefix}menu to see all commands_`
          const image = process.env.MENU_IMAGE
          try {
            await thisSock.sendMessage(jid, image ? { image: { url: image }, caption: alert } : { text: alert })
          } catch {
            try { await thisSock.sendMessage(jid, { text: alert }) } catch (e) {
              console.log(`⚠️ [${s.id}] Could not send confirmation:`, e.message)
            }
          }
        }
      }

      if (connection === 'close') {
        s.status = 'disconnected'
        s.lastQR = null
        emitTo(s, 'status', s.status)

        const err = lastDisconnect?.error
        const code = err?.output?.statusCode
        const msg = String(err?.message || '')
        console.log(`❌ [${s.id}] Connection closed. Code: ${code} | ${msg}`)
        const paired = s.live

        // 515 = WhatsApp asks for a restart right after a successful pairing. Just reconnect.
        if (code === DisconnectReason.restartRequired) {
          scheduleStart(s, 1000)
          return
        }

        // Another copy is using this login. Stop WITHOUT logging out.
        // (401 + "conflict" means the device was removed from the phone = logged out, handled below)
        if (
          code === DisconnectReason.connectionReplaced ||
          (code !== DisconnectReason.loggedOut && msg.toLowerCase().includes('conflict'))
        ) {
          s.status = 'conflict'
          console.log(`🚨 [${s.id}] CONFLICT: another copy uses this login. Stopping this session.`)
          stopSocket(s)
          return
        }

        // Really logged out
        if (code === DisconnectReason.loggedOut && paired) {
          if (s.isMain) {
            console.log('🔒 Main logged out. Clearing saved session. Scan a new QR.')
            await clearSavedSession(s)
            s.live = false
            s.restored = true
            scheduleStart(s, 3000)
          } else {
            await removeSession(s, 'user logged out')
          }
          return
        }

        // Pairing never finished
        if (!paired) {
          if (s.isMain) {
            console.log('🧹 Pairing did not finish. Starting fresh with a new QR.')
            fs.rmSync(s.dir, { recursive: true, force: true })
            s.live = false
            s.restored = true
            scheduleStart(s, 3000)
          } else {
            emitTo(s, 'pairError', 'Pairing did not finish. Try again.')
            await removeSession(s, 'pairing did not finish')
          }
          return
        }

        // Anything else: reconnect
        scheduleStart(s, 5000)
      }
    })

    thisSock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (thisSock !== s.sock) return
      for (const m of messages) cacheMessage(s, m)
      if (type !== 'notify') return
      for (const m of messages) {
        try {
          await handleMessage(thisSock, m)
        } catch (e) {
          console.log(`❌ [${s.id}] Message handler error:`, e.stack || e)
        }
      }
    })
  } finally {
    s.starting = false
  }
}

// ---------- Load every saved session at startup ----------
async function startAllSessions() {
  const ids = []
  try {
    const { data, error } = await supabase.from('bu_sessions').select('id')
    if (error) throw error
    const saved = (data || []).map((r) => r.id)
    // The main login only starts if it has a saved session (or ENABLE_MAIN=true).
    // Otherwise it would sit there making QR codes nobody scans.
    if (saved.includes(MAIN_ID) || process.env.ENABLE_MAIN === 'true') ids.push(MAIN_ID)
    for (const id of saved) if (id.startsWith('user_')) ids.push(id)
  } catch (e) {
    console.log('⚠️ Could not list saved sessions:', e.message)
    ids.push(MAIN_ID)
  }
  if (!ids.length) console.log('ℹ️ No saved sessions yet. Open /pair.html to link a number.')

  console.log(`👥 Starting ${Math.min(ids.length, MAX_SESSIONS)} session(s) (max ${MAX_SESSIONS})`)
  for (const id of ids.slice(0, MAX_SESSIONS)) {
    const s = makeState(id)
    sessions.set(id, s)
    try {
      await startSession(s)
    } catch (e) {
      console.log(`❌ [${id}] start failed:`, e.message)
      scheduleStart(s, 5000)
    }
    await sleep(STAGGER_MS) // connect one at a time to avoid memory spikes
  }
}

// ---------- Boot everything ----------
server.listen(PORT, async () => {
  console.log(`🌐 Server running on port ${PORT}`)
  await loadCommands()
  await loadObservers()
  await loadSettings()
  if (START_DELAY_MS > 0) {
    console.log(`⏳ Waiting ${START_DELAY_MS / 1000}s so any older copy can shut down first...`)
    await sleep(START_DELAY_MS)
  }
  await startAllSessions()
})

// Save every session when Render stops this copy during a deploy
async function shutdown() {
  try { await Promise.all([...sessions.values()].map((s) => uploadSession(s))) } catch {}
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

process.on('unhandledRejection', (e) => console.log('Unhandled rejection:', e))
process.on('uncaughtException', (e) => console.log('Uncaught exception:', e))
                                          
