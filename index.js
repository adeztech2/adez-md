global.WebSocket = require('ws');

const _origConsoleLog = console.log;
console.log = function (...args) {
  const first = args[0];
  if (typeof first === 'string' && (
    first.startsWith('Closing session:') ||
    first.startsWith('Closing stale open session') ||
    first.startsWith('Closing open session')
  )) return;
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
const SUPABASE_WRITE_INTERVAL = 2 * 60 * 1000;

let sock = null;
let isConnected = false;
let isStarting = false;
let stoppingForConflict = false;
let lastQR = null;
let lastPairCode = null;
let lastSupabaseWrite = 0;
let pendingPairNumber = null;

app.use(express.static('public'));
app.get('/', (req, res) => res.json({
  status: 'ok',
  bot: process.env.BOT_NAME || 'ADEZ MD',
  connected: isConnected,
  uptime: process.uptime()
}));

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
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    const zipPath = path.join(__dirname, 'session_restore.zip');
    fs.writeFileSync(zipPath, Buffer.from(data.data, 'base64'));
    new AdmZip(zipPath).extractAllTo(SESSION_DIR, true);
    fs.unlinkSync(zipPath);
    console.log('✅ Session restored from Supabase.');
  } catch (err) {
    console.error('❌ Failed to restore session:', err.message);
  }
}

async function clearSession() {
  console.log('🧹 Clearing stale session (local + Supabase)...');
  try { fs.rmSync(SESSION_DIR, { recursive: true, force: true }); }
  catch (err) { console.error('❌ Failed to clear local session:', err.message); }

  try {
    const { error } = await supabase.from('bu_sessions').delete().eq('id', 'main');
    if (error) console.error('❌ Failed to clear Supabase session:', error.message);
  } catch (err) {
    console.error('❌ Failed to clear Supabase session:', err.message);
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
    const { error } = await supabase.from('bu_sessions').upsert({
      id: 'main',
      data: zip.toBuffer().toString('base64')
    });
    if (error) console.error('❌ Supabase save error:', error.message);
    else console.log('💾 Session synced to Supabase.');
  } catch (err) {
    console.error('❌ Failed to save session:', err.message);
  }
}

function isCurrentSocket(currentSock) {
  return sock === currentSock && !stoppingForConflict;
}

async function sendConnectionNotice(currentSock) {
  if (!isCurrentSocket(currentSock) || !isConnected || !currentSock.user) return;

  const ownerNumber = process.env.OWNER_NUMBER;
  if (!ownerNumber) return;
  const owner = ownerNumber.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
  const caption = `✅ *${process.env.BOT_NAME || 'ADEZ MD'}* is now connected and online!`;

  try {
    let picUrl = process.env.BOT_PIC_URL || null;
    if (!picUrl) {
      try {
        const botJid = currentSock.user.id.split(':')[0] + '@s.whatsapp.net';
        picUrl = await currentSock.profilePictureUrl(botJid, 'image');
      } catch (_) {}
    }

    // Never let a stale socket's confirmation message crash the process.
    if (!isCurrentSocket(currentSock)) return;
    if (picUrl) await currentSock.sendMessage(owner, { image: { url: picUrl }, caption });
    else await currentSock.sendMessage(owner, { text: caption });
  } catch (err) {
    console.error('⚠️ Could not send connection confirmation:', err.message);
  }
}

async function startBot() {
  if (isStarting || stoppingForConflict) return;
  isStarting = true;

  try {
    await restoreSession();
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version } = await fetchLatestBaileysVersion();
    const currentSock = makeWASocket({
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

    sock = currentSock;
    currentSock.ev.on('creds.update', saveCreds);

    currentSock.ev.on('connection.update', async (update) => {
      if (sock !== currentSock || stoppingForConflict) return;
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        const qrImage = await QRCode.toDataURL(qr);
        if (!isCurrentSocket(currentSock)) return;
        lastQR = qrImage;
        io.emit('qr', qrImage);

        if (pendingPairNumber) {
          const number = pendingPairNumber;
          pendingPairNumber = null;
          try {
            const code = await currentSock.requestPairingCode(number);
            if (!isCurrentSocket(currentSock)) return;
            lastPairCode = code;
            io.emit('pairing-code', code);
            console.log(`🔑 Pairing code generated for ${number}: ${code}`);
          } catch (err) {
            console.error('❌ Failed to generate pairing code:', err.message);
            io.emit('pair-error', 'Failed to generate code. Try again.');
          }
        }
      }

      if (connection === 'open') {
        if (!isCurrentSocket(currentSock)) return;
        isConnected = true;
        isStarting = false;
        lastQR = null;
        lastPairCode = null;
        console.log('✅ Bot connected to WhatsApp!');
        io.emit('connected');
        await saveSessionToSupabase();
        await sendConnectionNotice(currentSock);
      }

      if (connection === 'close') {
        if (sock !== currentSock) return;
        isConnected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const errorMsg = lastDisconnect?.error?.message || '';

        if (errorMsg.toLowerCase().includes('conflict') || statusCode === DisconnectReason.multideviceMismatch) {
          // Do not clear the session or create another socket. That causes the
          // conflict loop. Stop and let Render restart after the other session
          // has been logged out manually.
          stoppingForConflict = true;
          isStarting = false;
          console.error('❌ WhatsApp session conflict. Log out every other bot instance/linked device, then restart this service.');
          try { currentSock.end(new Error('WhatsApp session conflict')); } catch (_) {}
          process.exitCode = 1;
          process.exit(1);
          return;
        }

        if (statusCode === DisconnectReason.loggedOut) {
          isStarting = false;
          await clearSession();
          setTimeout(startBot, 1500);
          return;
        }

        isStarting = false;
        console.log('🔁 Connection closed, reconnecting...');
        setTimeout(startBot, 1500);
      }
    });

    const { loadCommands, handleMessage } = require('./lib/router');
    await loadCommands();
    currentSock.ev.on('messages.upsert', async (m) => {
      if (!isCurrentSocket(currentSock)) return;
      try {
        await handleMessage(currentSock, m);
      } catch (err) {
        console.error('❌ Error handling message:', err.message);
      }
    });
  } catch (err) {
    console.error('❌ Failed to start bot:', err.message);
    isStarting = false;
    if (!stoppingForConflict) setTimeout(startBot, 3000);
  }
}

io.on('connection', (socket) => {
  console.log('🌐 Pair page opened.');
  if (lastQR && !isConnected) socket.emit('qr', lastQR);
  if (lastPairCode && !isConnected) socket.emit('pairing-code', lastPairCode);

  socket.on('request-pair-code', async (number) => {
    if (!sock) return;
    if (isConnected) return socket.emit('pair-error', 'Already connected. Log out before pairing again.');

    const cleaned = String(number || '').replace(/[^0-9]/g, '');
    if (cleaned.length < 10 || cleaned.length > 15 || cleaned.startsWith('0')) {
      return socket.emit('pair-error', 'Invalid number format. Include country code, without a leading 0.');
    }

    try {
      pendingPairNumber = cleaned;
      await clearSession();
      const oldSock = sock;
      sock = null;
      try { oldSock.end(new Error('resetting for fresh pairing-code request')); } catch (_) {}
      isStarting = false;
      setTimeout(startBot, 500);
    } catch (err) {
      pendingPairNumber = null;
      console.error('❌ Failed to reset session for pairing code:', err.message);
      socket.emit('pair-error', 'Failed to reset session. Try again or use QR instead.');
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  startBot();
});
