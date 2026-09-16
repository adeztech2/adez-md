global.WebSocket = require('ws');
const originalLog = console.log;
console.log = (...args) => {
  const text = String(args[0] || '');
  if (/^Closing (stale |open )?session:/.test(text)) return;
  originalLog(...args);
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
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const SESSION_DIR = path.join(__dirname, 'session');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const WRITE_INTERVAL = 2 * 60 * 1000;

let sock = null;
let connected = false;
let starting = false;
let stoppedForConflict = false;
let lastQR = null;
let lastPairCode = null;
let lastEvent = 'Starting bot';
let lastNumber = null;
let lastWrite = 0;
let pendingPairNumber = null;
let getCommands = () => [];

function uptimeText() {
  const seconds = Math.floor(process.uptime());
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${seconds % 60}s`;
}
function statusEvent(event, extra = {}) {
  lastEvent = event;
  io.emit('bot-status', { connected, number: lastNumber, event, ...extra });
  console.log(event);
}
function activity(data) { io.emit('activity', data); }
function currentSocket(current) { return sock === current && !stoppedForConflict; }

app.use(express.static('public'));
const status = () => ({ status: 'ok', bot: process.env.BOT_NAME || 'ADEZ MD', connected, number: lastNumber, uptime: process.uptime(), uptimeText: uptimeText(), lastEvent, commands: getCommands() });
app.get('/', (_, res) => res.json(status()));
app.get('/api/status', (_, res) => res.json(status()));

async function restoreSession() {
  const { data, error } = await supabase.from('bu_sessions').select('data').eq('id', 'main').single();
  if (error || !data) { statusEvent('No saved session; waiting for pairing'); return; }
  try {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    const zipPath = path.join(__dirname, 'session_restore.zip');
    fs.writeFileSync(zipPath, Buffer.from(data.data, 'base64'));
    new AdmZip(zipPath).extractAllTo(SESSION_DIR, true);
    fs.unlinkSync(zipPath);
    statusEvent('Session restored from Supabase');
  } catch (err) { statusEvent(`Session restore failed: ${err.message}`); }
}
async function clearSession() {
  fs.rmSync(SESSION_DIR, { recursive: true, force: true });
  const { error } = await supabase.from('bu_sessions').delete().eq('id', 'main');
  if (error) console.error('Session delete failed:', error.message);
  lastQR = null; lastPairCode = null; lastWrite = 0;
}
async function saveSession() {
  if (Date.now() - lastWrite < WRITE_INTERVAL) return;
  lastWrite = Date.now();
  try {
    const zip = new AdmZip(); zip.addLocalFolder(SESSION_DIR);
    const { error } = await supabase.from('bu_sessions').upsert({ id: 'main', data: zip.toBuffer().toString('base64') });
    if (error) console.error('Session save failed:', error.message); else statusEvent('Session synced to Supabase');
  } catch (err) { console.error('Session save failed:', err.message); }
}

async function startBot() {
  if (starting || stoppedForConflict) return;
  starting = true;
  try {
    await restoreSession();
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version } = await fetchLatestBaileysVersion();
    const current = makeWASocket({ version, auth: state, logger: pino({ level: 'silent' }), printQRInTerminal: false, syncFullHistory: false, fireInitQueries: false, browser: Browsers.macOS('Safari'), markOnlineOnConnect: false, retryRequestDelayMs: 500, maxMsgRetryCount: 5 });
    sock = current;
    current.ev.on('creds.update', saveCreds);
    const router = require('./lib/router');
    getCommands = router.getAllCommands;
    await router.loadCommands();
    io.emit('commands', getCommands());
    statusEvent(`${getCommands().length} commands loaded`);

    current.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (!currentSocket(current)) return;
      if (qr) {
        lastQR = await QRCode.toDataURL(qr);
        io.emit('qr', lastQR);
        statusEvent('QR code generated');
        if (pendingPairNumber) {
          const number = pendingPairNumber; pendingPairNumber = null;
          try { lastPairCode = await current.requestPairingCode(number); io.emit('pairing-code', lastPairCode); statusEvent('Pairing code generated'); }
          catch (err) { io.emit('pair-error', err.message); statusEvent(`Pairing code failed: ${err.message}`); }
        }
      }
      if (connection === 'open') {
        connected = true; starting = false; lastQR = null; lastPairCode = null;
        lastNumber = current.user?.id?.split(':')[0] || null;
        statusEvent('Bot connected to WhatsApp'); io.emit('connected'); await saveSession();
      }
      if (connection === 'close') {
        connected = false;
        const code = lastDisconnect?.error?.output?.statusCode;
        const message = lastDisconnect?.error?.message || '';
        if (message.toLowerCase().includes('conflict') || code === DisconnectReason.multideviceMismatch) {
          stoppedForConflict = true; starting = false;
          statusEvent('SESSION CONFLICT: log out other linked devices, then restart');
          try { current.end(new Error('session conflict')); } catch (_) {}
          process.exitCode = 1; process.exit(1); return;
        }
        if (code === DisconnectReason.loggedOut) {
          starting = false; statusEvent('Logged out; clearing session'); await clearSession(); setTimeout(startBot, 1500); return;
        }
        starting = false; statusEvent('Connection closed; reconnecting'); setTimeout(startBot, 1500);
      }
    });
    current.ev.on('messages.upsert', async update => {
      if (!currentSocket(current)) return;
      try { await router.handleMessage(current, update, activity); }
      catch (err) { activity({ type: 'handler-error', error: err.message }); console.error('Message handler error:', err.message); }
    });
  } catch (err) {
    starting = false; statusEvent(`Startup failed: ${err.message}`); if (!stoppedForConflict) setTimeout(startBot, 3000);
  }
}

io.on('connection', socket => {
  socket.emit('bot-status', { connected, number: lastNumber, event: lastEvent });
  socket.emit('commands', getCommands());
  if (lastQR && !connected) socket.emit('qr', lastQR);
  if (lastPairCode && !connected) socket.emit('pairing-code', lastPairCode);
  socket.on('request-pair-code', async value => {
    if (connected) return socket.emit('pair-error', 'Bot is already connected.');
    if (pendingPairNumber) return socket.emit('pair-error', 'A pairing request is already in progress.');
    const number = String(value || '').replace(/[^0-9]/g, '');
    if (number.length < 10 || number.length > 15 || number.startsWith('0')) return socket.emit('pair-error', 'Use a valid country-code number without a leading 0.');
    pendingPairNumber = number;
    try {
      const old = sock; sock = null; connected = false;
      if (old) old.end(new Error('pairing reset'));
      await clearSession(); starting = false; statusEvent('Pairing reset requested'); setTimeout(startBot, 500);
    } catch (err) { pendingPairNumber = null; socket.emit('pair-error', err.message); }
  });
});

server.listen(PORT, () => { console.log(`🚀 Server running on port ${PORT}`); startBot(); });
