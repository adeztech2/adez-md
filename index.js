// ============================================================
//  ADEZ MD - index.js  (the main brain / front door of the bot)
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

// ---------- Settings (read from .env or Render Environment Variables) ----------
const BOT_NAME = process.env.BOT_NAME || 'ADEZ MD'
const OWNER_NUMBER = (process.env.OWNER_NUMBER || '').replace(/\D/g, '')
const PORT = process.env.PORT || 3000
const SESSION_DIR = path.resolve('./session')
const SESSION_ID = 'session'
const SYNC_INTERVAL = 2 * 60 * 1000 // 2 minutes (throttle)

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

// Health endpoint for UptimeRobot
app.get('/', (req, res) => {
  res.json({ status: 'ok', bot: BOT_NAME, connection: botStatus, uptime: Math.floor(process.uptime()) })
})
app.use(express.static('public', { index: false }))

io.on('connection', (client) => {
  client.emit('status', botStatus)
  if (lastQR) client.emit('qr', lastQR)

  // Pair code: user types phone number on pair.html
  client.on('requestPair', async (number) => {
    try {
      const clean = String(number || '').replace(/\D/g, '')
      if (!clean) return client.emit('pairError', 'Enter your number with country code')
      if (!sock) return client.emit('pairError', 'Bot not ready yet, try again in a few seconds')
      if (sock.authState?.creds?.registered) return client.emit('pairError', 'Already logged in')
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
    if (!fs.existsSync(SESSION_DIR)) return
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

// Throttle: save at most once every 2 minutes
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

// ---------- Start the WhatsApp connection ----------
async function startBot() {
  if (!restored) {
    await restoreSession()
    restored = true
  }

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
  const { version } = await fetchLatestBaileysVersion()

  sock = makeWASocket({
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

  sock.ev.on('creds.update', async () => {
    await saveCreds()
    scheduleSync()
  })

  sock.ev.on('connection.update', async (update) => {
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
      console.log(`✅ ${BOT_NAME} connected!`)
      uploadSession()

      if (OWNER_NUMBER && !welcomeSent) {
        welcomeSent = true
        try {
          await sock.sendMessage(OWNER_NUMBER + '@s.whatsapp.net', {
            text: `✅ *${BOT_NAME}* is online!\nCommands loaded: ${getAllCommands().length}`
          })
        } catch (e) {
          console.log('⚠️ Could not send confirmation:', e.message)
        }
      }
    }

    if (connection === 'close') {
      botStatus = 'disconnected'
      const err = lastDisconnect?.error
      const code = err?.output?.statusCode
      const msg = String(err?.message || '')
      console.log(`❌ Connection closed. Code: ${code} | ${msg}`)

      // Conflict = bot running twice somewhere. Kill this one.
      if (msg.toLowerCase().includes('conflict')) {
        console.log('🚨 Stream Errored (conflict): another copy of the bot is running. Logging out and exiting.')
        try { await sock.logout() } catch {}
        process.exit(1)
      }

      // Logged out = session no longer valid. Clear and start fresh.
      if (code === DisconnectReason.loggedOut) {
        console.log('🔒 Logged out. Clearing saved session. Scan a new QR.')
        await clearSavedSession()
        setTimeout(startBot, 3000)
        return
      }

      // Anything else: reconnect
      console.log('🔄 Reconnecting in 5 seconds...')
      setTimeout(startBot, 5000)
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const m of messages) {
      try {
        await handleMessage(sock, m)
      } catch (e) {
        console.log('❌ Message handler error:', e.stack || e)
      }
    }
  })
}

// ---------- Boot everything ----------
server.listen(PORT, async () => {
  console.log(`🌐 Server running on port ${PORT}`)
  await loadCommands()
  await loadObservers()
  await startBot()
})

process.on('unhandledRejection', (e) => console.log('Unhandled rejection:', e))
process.on('uncaughtException', (e) => console.log('Uncaught exception:', e))
      
