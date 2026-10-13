// ============================================================
//  ADEZ MD - index.js  (patched: safer pairing + session handling)
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
import baileys from '@whiskeysockets/baileys'
const makeWASocket = baileys.default || baileys.makeWASocket || baileys
const {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} = baileys
import { loadCommands, loadObservers, handleMessage, getAllCommands } from './lib/router.js'

// ---------- Settings ----------
const BOT_NAME = process.env.BOT_NAME || 'ADEZ MD'
const OWNER_NUMBER = (process.env.OWNER_NUMBER || '').replace(/\D/g, '')
const PORT = process.env.PORT || 3000
const SESSION_DIR = path.resolve('./session')
const SESSION_ID = 'session'
const SYNC_INTERVAL = 2 * 60 * 1000 // 2 minutes (throttle)
// On Render a new deploy starts BEFORE the old copy stops. Wait a bit so
// two copies never use the same WhatsApp login at the same time.
const START_DELAY_MS = Number(process.env.START_DELAY_MS ?? (process.env.RENDER ? 15000 : 0))

const logger = pino({ level: 'silent' })
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

// ---------- Express web server + Socket.IO ----------
const app = express()
const server = http.createServer(app)
const io = new Server(server)

let sock = null
let botStatus = 'starting'
let lastQR = null
let restored = false
let welcomeSent = false
let starting = false
let sessionWasLive = false // true only if this login really worked (restored from Supabase or reached 'open')
let startTimer = null
let pendingSave = Promise.resolve()

app.get('/', (req, res) => {
  res.json({ status: 'ok', bot: BOT_NAME, connection: botStatus, uptime: Math.floor(process.uptime()) })
})
app.use(express.static('public', { index: false }))

io.on('connection', (client) => {
  client.emit('status', botStatus)
  if (lastQR) client.emit('qr', lastQR)

  client.on('requestPair', async (number) => {
    try {
      const clean = String(number || '').replace(/\D/g, '')
      if (!clean) return client.emit('pairError', 'Enter your number with country code')
      if (botStatus === 'connected') return client.emit('pairError', 'Already logged in')
      // A QR event means the socket is ready. Asking earlier makes pairing fail.
      if (!sock || botStatus !== 'waiting_for_scan') {
        return client.emit('pairError', 'Bot not ready yet, wait for the QR to appear and try again')
      }
      const code = await sock.requestPairingCode(clean)
      client.emit('pairCode', code)
    } catch (e) {
      client.emit('pairError', 'Failed: ' + e.message)
    }
  })
})

// ---------- Supabase session sync ----------
async function restoreSession() {
  try {
    const { data, error } = await supabase.from('bu_sessions').select('data').eq('id', SESSION_ID).maybeSingle()
    if (error) throw error
    if (data?.data) {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true })
      fs.mkdirSync(SESSION_DIR, { recursive: true })
      new AdmZip(Buffer.from(data.data, 'base64')).extractAllTo(SESSION_DIR, true)
      sessionWasLive = true
      console.log('✅ Session restored from Supabase')
    } else {
      console.log('ℹ️ No saved session in Supabase (QR needed)')
    }
  } catch (e) {
    console.log('⚠️ Could not restore session:', e.message)
  }
}

let lastSync = 0
let syncTimer = null
async function uploadSession() {
  try {
    // Only save a login that really works (never a half-finished pairing)
    if (botStatus !== 'connected') return
    if (!fs.existsSync(SESSION_DIR)) return
    await pendingSave
    const zip = new AdmZip()
    zip.addLocalFolder(SESSION_DIR)
    const base64 = zip.toBuffer().toString('base64')
    const { error } = await supabase.from('bu_sessions').upsert({ id: SESSION_ID, data: base64 })
    if (error) throw error
    lastSync = Date.now()
    console.log('☁️ Session saved to Supabase')
  } catch (e) {
    console.log('⚠️ Session upload failed:', e.message)
  }
}

function scheduleSync() {
  if (syncTimer) return
  const wait = Math.max(0, SYNC_INTERVAL - (Date.now() - lastSync))
  syncTimer = setTimeout(async () => {
    syncTimer = null
    await uploadSession()
  }, wait)
}

async function clearSavedSession() {
  fs.rmSync(SESSION_DIR, { recursive: true, force: true })
  await supabase.from('bu_sessions').delete().eq('id', SESSION_ID)
}

// ---------- Helpers to keep ONE socket alive at a time ----------
function stopSocket() {
  if (!sock) return
  const old = sock
  sock = null
  try { old.ev.removeAllListeners() } catch {}
  try { old.end(undefined) } catch {}
}

function scheduleStart(ms) {
  if (startTimer) clearTimeout(startTimer)
  startTimer = setTimeout(() => {
    startTimer = null
    startBot().catch((e) => {
      console.log('❌ startBot failed:', e.message)
      scheduleStart(5000)
    })
  }, ms)
}

// ---------- Start the WhatsApp connection ----------
async function startBot() {
  if (starting) return
  starting = true
  try {
    stopSocket()
    await pendingSave // make sure the last creds write finished

    if (!restored) {
      await restoreSession()
      restored = true
    }

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
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
      generateHighQualityLinkPreview: false
    })
    sock = thisSock

    thisSock.ev.on('creds.update', () => {
      pendingSave = pendingSave
        .then(() => saveCreds())
        .catch((e) => console.log('⚠️ saveCreds failed:', e.message))
      scheduleSync()
    })

    thisSock.ev.on('connection.update', async (update) => {
      if (thisSock !== sock) return // ignore events from an old socket
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        lastQR = await QRCode.toDataURL(qr)
        botStatus = 'waiting_for_scan'
        io.emit('qr', lastQR)
        io.emit('status', botStatus)
        console.log('📱 QR ready - open /pair.html to scan')
      }

      if (connection === 'open') {
        lastQR = null
        botStatus = 'connected'
        io.emit('status', botStatus)
        sessionWasLive = true
        console.log(`✅ ${BOT_NAME} connected!`)
        uploadSession()

        if (OWNER_NUMBER && !welcomeSent) {
          welcomeSent = true
          try {
            await thisSock.sendMessage(OWNER_NUMBER + '@s.whatsapp.net', {
              text: `✅ *${BOT_NAME}* is online!\nCommands loaded: ${getAllCommands().length}`
            })
          } catch (e) {
            console.log('⚠️ Could not send confirmation:', e.message)
          }
        }
      }

      if (connection === 'close') {
        botStatus = 'disconnected'
        lastQR = null // never show a QR that belongs to a dead socket
        io.emit('status', botStatus)

        const err = lastDisconnect?.error
        const code = err?.output?.statusCode
        const msg = String(err?.message || '')
        console.log(`❌ Connection closed. Code: ${code} | ${msg}`)

        // Did this login ever really work? (creds.me is NOT a safe check: requesting
        // a pairing code sets it before any pairing has happened)
        const paired = sessionWasLive

        // 515 = WhatsApp asks for a restart right after a successful scan. Just reconnect.
        if (code === DisconnectReason.restartRequired) {
          console.log('🔄 Restart requested by WhatsApp (normal after scanning).')
          scheduleStart(1000)
          return
        }

        // Another copy is using this login. Exit WITHOUT logging out,
        // because logout would also kill the login the other copy is using.
        if (code === DisconnectReason.connectionReplaced || msg.toLowerCase().includes('conflict')) {
          console.log('🚨 Another copy of the bot is running. Exiting this one.')
          process.exit(1)
        }

        // A login that worked before was really logged out: clear everything.
        if (code === DisconnectReason.loggedOut && paired) {
          console.log('🔒 Logged out. Clearing saved session. Scan a new QR.')
          await clearSavedSession()
          sessionWasLive = false
          restored = true
          scheduleStart(3000)
          return
        }

        // Pairing never finished (QR timeout 408, 500 "Invalid account signature",
        // or 401 on half-made credentials). Wipe ONLY the local half-login and start clean.
        if (!paired) {
          console.log('🧹 Pairing did not finish. Starting fresh with a new QR.')
          fs.rmSync(SESSION_DIR, { recursive: true, force: true })
          sessionWasLive = false
          restored = true // do NOT download the old saved session again
          scheduleStart(3000)
          return
        }

        // Anything else: just reconnect
        console.log('🔄 Reconnecting in 5 seconds...')
        scheduleStart(5000)
      }
    })

    thisSock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (thisSock !== sock) return
      if (type !== 'notify') return
      for (const m of messages) {
        try {
          await handleMessage(thisSock, m)
        } catch (e) {
          console.log('❌ Message handler error:', e.stack || e)
        }
      }
    })
  } finally {
    starting = false
  }
}

// ---------- Boot everything ----------
server.listen(PORT, async () => {
  console.log(`🌐 Server running on port ${PORT}`)
  await loadCommands()
  await loadObservers()
  if (START_DELAY_MS > 0) {
    console.log(`⏳ Waiting ${START_DELAY_MS / 1000}s so any older copy can shut down first...`)
    await new Promise((r) => setTimeout(r, START_DELAY_MS))
  }
  await startBot()
})

// Save the latest session when Render stops this copy during a deploy
async function shutdown() {
  try { await uploadSession() } catch {}
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

process.on('unhandledRejection', (e) => console.log('Unhandled rejection:', e))
process.on('uncaughtException', (e) => console.log('Uncaught exception:', e))
                                                                                    
