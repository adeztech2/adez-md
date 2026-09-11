global.WebSocket = require('ws');

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
  fetchLatestBaileysVersion
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
    browser: ['ADEZ MD', 'Chrome', '1.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('📱 New QR generated, sending to pair page...');
      const qrImage = await QRCode.toDataURL(qr);
      lastQR = qrImage;
      io.emit('qr', qrImage);
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
        console.log('🚪 Logged out. Delete session and rescan.');
        process.exit(1);
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

  // Immediately send the latest QR/code, if one already exists
  if (lastQR && !isConnected) {
    socket.emit('qr', lastQR);
  }
  if (lastPairCode && !isConnected) {
    socket.emit('pairing-code', lastPairCode);
  }

  socket.on('request-pair-code', async (number) => {
    if (!sock) return;
    try {
      const code = await sock.requestPairingCode(number.replace(/[^0-9]/g, ''));
      lastPairCode = code;
      socket.emit('pairing-code', code);
      console.log(`🔑 Pairing code generated: ${code}`);
    } catch (err) {
      console.error('❌ Failed to generate pairing code:', err);
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  startBot();
});
