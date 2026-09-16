global.WebSocket = require('ws');

// libsignal (a Baileys dependency) calls console.log() directly to dump full
// session objects — including raw private key bytes — whenever it closes or
// rebuilds a session. This happens regardless of the pino logger config below,
// so it's filtered here, before anything else is required, to stop key
// material from ever reaching stdout/log storage.
const _origConsoleLog = console.log;
console.log = function (...args) {
  const first = args[0];
  if (
    typeof first === 'string' &&
    (first.startsWith('Closing session:') ||
      first.startsWith('Closing stale open session') ||
      first.startsWith('Closing open session'))
  ) {
    return; // swallow libsignal's raw session/key dump
  }
  _origConsoleLog.apply(console, args);
};

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const QRCode = require('qrcode');
const pino = require('pino');
const { createClient } = require('@supabase/supabase-js');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys');

require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

const SESSION_DIR = path.join(__dirname, 'session');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

let sock;
let isConnected = false;
let lastQR = null;
let lastPairCode = null;
let lastSupabaseWrite = 0;
let pendingPairNumber = null; // set when a fresh pairing-code request is in flight
const SUPABASE_WRITE_INTERVAL = 2 * 60 * 1000; // 2 minutes throttle

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    bot: process.env.BOT_NAME || 'ADEZ MD',
    connected: isConnected,
    uptime: process.uptime()
  });
});

async function restoreSession() {
  console.log('🔄 Checking Supabase for saved session...');
  const { data, error } = await supabase
    .from('bu_sessions')
    .select('data')
    .eq('id', 'main')
    .single();

  if (error || !data) {
    console.log('ℹ️ No saved session found, will need QR/pair code.');
    return;
  }

  try {
    if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
    const buffer = Buffer.from(data.data, 'base64');
    const zipPath = path.join(__dirname, 'session_restore.zip');
    fs.writeFileSync(zipPath, buffer);
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(SESSION_DIR, true);
    fs.unlinkSync(zipPath);
    console.log('✅ Session restored from Supabase.');
  } catch (err) {
    console.error('❌ Failed to restore session:', err);
  }
}

async function clearSession() {
  console.log('🧹 Clearing stale session (local + Supabase)...');

  try {
    if (fs.existsSync(SESSION_DIR)) {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
    }
  } catch (err) {
    console.error('❌ Failed to clear local session folder:', err);
  }

  try {
    const { error } = await supabase
      .from('bu_sessions')
      .delete()
      .eq('id', 'main');
    if (error) {
      console.error('❌ Failed to clear Supabase session row:', error.message);
    }
  } catch (err) {
    console.error('❌ Failed to clear Supabase session row:', err);
  }

  lastSupabaseWrite = 0;
  lastQR = null;
  lastPairCode = null;
}

async function saveSessionToSupabase() {
  const now = Date.now();
  if (now - lastSupabaseWrite < SUPABASE_WRITE_INTERVAL) return;
  lastSupabaseWrite = now;

  try {
    const zip = new AdmZip();
    zip.addLocalFolder(SESSION_DIR);
    const buffer = zip.toBuffer();
    const base64 = buffer.toString('base64');

    const { error } = await supabase
      .from('bu_sessions')
      .upsert({ id: 'main', data: base64 });

    if (error) {
      console.error('❌ Supabase save error:', error.message);
    } else {
      console.log('💾 Session synced to Supabase.');
    }
  } catch (err) {
    console.error('❌ Failed to zip/save session:', err);
  }
}

async function startBot() {
  await restoreSession();

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    syncFullHistory: false,
    fireInitQueries: false,
    browser: Browsers.macOS('Safari'),
    markOnlineOnConnect: false,
    retryRequestDelayMs: 500,
    maxMsgRetryCount: 5
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('📱 New QR generated, sending to pair page...');
      const qrImage = await QRCode.toDataURL(qr);
      lastQR = qrImage;
      io.emit('qr', qrImage);

      if (pendingPairNumber) {
        const number = pendingPairNumber;
        pendingPairNumber = null;
        try {
          const code = await sock.requestPairingCode(number);
          lastPairCode = code;
          io.emit('pairing-code', code);
          console.log(`🔑 Pairing code generated for ${number}: ${code}`);
        } catch (err) {
          console.error('❌ Failed to generate pairing code after reset:', err);
          io.emit('pair-error', 'Failed to generate code after reset. Try again.');
        }
      }
    }

    if (connection === 'open') {
      isConnected = true;
      lastQR = null;
      lastPairCode = null;
      console.log('✅ Bot connected to WhatsApp!');
      io.emit('connected');
      await saveSessionToSupabase();

      const owner = process.env.OWNER_NUMBER + '@s.whatsapp.net';
      try {
        await sock.sendMessage(owner, {
          text: `✅ *${process.env.BOT_NAME || 'ADEZ MD'}* is now connected and online!`
        });
      } catch (e) {
        console.error('Could not send confirmation to owner:', e.message);
      }
    }

    if (connection === 'close') {
      isConnected = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const errorMsg = lastDisconnect?.error?.message || '';

      if (errorMsg.includes('conflict') || statusCode === DisconnectReason.multideviceMismatch) {
        console.error('❌ Stream Errored (conflict). Another session is active. Logging out and exiting.');
        try { await sock.logout(); } catch (e) {}
        process.exit(1);
      }

      if (statusCode === DisconnectReason.loggedOut) {
        console.log('🚪 Logged out. Clearing stale session and restarting for a fresh pair...');
        await clearSession();
        startBot();
        return;
      }

      console.log('🔁 Connection closed, reconnecting...');
      startBot();
    }
  });

  const { loadCommands, handleMessage } = require('./lib/router');
  await loadCommands();

  sock.ev.on('messages.upsert', async (m) => {
    try {
      await handleMessage(sock, m);
    } catch (err) {
      console.error('❌ Error handling message:', err);
    }
  });
}

io.on('connection', (socket) => {
  console.log('🌐 Pair page opened.');

  if (lastQR && !isConnected) {
    socket.emit('qr', lastQR);
  }
  if (lastPairCode && !isConnected) {
    socket.emit('pairing-code', lastPairCode);
  }

  socket.on('request-pair-code', async (number) => {
    if (!sock) return;
    if (isConnected) {
      socket.emit('pair-error', 'Already connected. Log out before pairing again.');
      return;
    }

    const cleaned = number.replace(/[^0-9]/g, '');

    if (cleaned.length < 10 || cleaned.length > 15) {
      console.warn(`⚠️ Rejected pairing code request: invalid number length "${cleaned}"`);
      socket.emit('pair-error', 'Invalid number format. Include country code, no leading 0.');
      return;
    }

    try {
      // Wipe any stale/partial session first so this pairing starts from a clean slate.
      await clearSession();
      pendingPairNumber = cleaned;

      // Restart the socket on fresh credentials. The 'qr' handler in connection.update
      // will pick up pendingPairNumber and call requestPairingCode once the new
      // socket is ready.
      if (sock) {
        try {
          sock.end(new Error('resetting for fresh pairing-code request'));
        } catch (e) {
          // ignore - socket may already be closed
        }
      } else {
        startBot();
      }
    } catch (err) {
      console.error('❌ Failed to reset session for pairing code:', err);
      pendingPairNumber = null;
      socket.emit('pair-error', 'Failed to reset session. Try again or use QR instead.');
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  startBot();
});
      
