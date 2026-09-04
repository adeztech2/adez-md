// ============================================================
// ADEZ MD - WhatsApp Bot
// Main index.js
// Baileys 6.7.18
// Node.js 20.11.1
// Render + Supabase + QR + Pairing Code
// ============================================================

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    Browsers
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const axios = require('axios');
const AdmZip = require('adm-zip');
const fs = require('fs-extra');
const path = require('path');

// ------------------------------------------------------------
// COMMAND ROUTER
// ------------------------------------------------------------

const {
    loadCommands,
    getAllCommands,
    processCommand
} = require('./lib/router');

// ------------------------------------------------------------
// CONFIGURATION
// ------------------------------------------------------------

const PORT = Number(process.env.PORT) || 3000;

const BOT_NAME =
    process.env.BOT_NAME || 'Adez MD';

const OWNER_NUMBER =
    process.env.OWNER_NUMBER || '254101579396';

const OWNER_NUMBER_2 =
    process.env.OWNER_NUMBER_2 || '254111783552';

const PREFIX =
    process.env.PREFIX || '.';

const SUPABASE_URL =
    process.env.SUPABASE_URL;

const SUPABASE_ANON_KEY =
    process.env.SUPABASE_ANON_KEY;

const SESSION_NAME =
    process.env.SESSION_NAME || 'adez-md-session';

const SESSION_WRITE_INTERVAL =
    Number(process.env.SESSION_WRITE_INTERVAL) || 120000;

// ------------------------------------------------------------
// GLOBAL SETTINGS
// ------------------------------------------------------------

global.channels = [
    'https://whatsapp.com/channel/0029Vb8N0xYLikgHxdGh790m'
];

global.targetNumber = '254101579396';

global.autoStatusView = true;

global.commandsLoaded = false;

global.lastSessionSave = 0;

global.whatsappSocket = null;

global.isConnecting = false;

global.reconnectTimer = null;

global.pairingInProgress = false;

// ------------------------------------------------------------
// SESSION DIRECTORY
// ------------------------------------------------------------

const SESSION_DIR =
    path.join(__dirname, 'session');

// Make sure session directory exists
fs.ensureDirSync(SESSION_DIR);

// ------------------------------------------------------------
// EXPRESS SERVER
// ------------------------------------------------------------

const app = express();

const server =
    http.createServer(app);

const io =
    new Server(server, {
        cors: {
            origin: '*'
        }
    });

// ------------------------------------------------------------
// MIDDLEWARE
// ------------------------------------------------------------

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));

app.use(express.static(
    path.join(__dirname, 'public')
));

// ------------------------------------------------------------
// HEALTH CHECK
// ------------------------------------------------------------

app.get('/', (req, res) => {

    res.json({
        status: 'online',
        bot: BOT_NAME,
        whatsapp:
            global.whatsappSocket
                ? 'running'
                : 'offline',
        uptime: process.uptime(),
        timestamp:
            new Date().toISOString()
    });

});

// ------------------------------------------------------------
// STATUS API
// ------------------------------------------------------------

app.get('/api/status', (req, res) => {

    res.json({
        status: 'online',
        bot: BOT_NAME,
        connected:
            !!global.whatsappSocket,
        uptime: process.uptime(),
        timestamp:
            new Date().toISOString()
    });

});

// ------------------------------------------------------------
// SUPABASE VALIDATION
// ------------------------------------------------------------

if (!SUPABASE_URL) {

    console.warn(
        '⚠️ SUPABASE_URL is not configured.'
    );

}

if (!SUPABASE_ANON_KEY) {

    console.warn(
        '⚠️ SUPABASE_ANON_KEY is not configured.'
    );

}

// ------------------------------------------------------------
// SUPABASE REQUEST
// ------------------------------------------------------------

async function supabaseRequest(
    endpoint,
    options = {}
) {

    if (!SUPABASE_URL ||
        !SUPABASE_ANON_KEY) {

        throw new Error(
            'Supabase environment variables are missing.'
        );
    }

    const url =
        `${SUPABASE_URL}/rest/v1/${endpoint}`;

    const headers = {

        apikey:
            SUPABASE_ANON_KEY,

        Authorization:
            `Bearer ${SUPABASE_ANON_KEY}`,

        'Content-Type':
            'application/json',

        ...options.headers
    };

    return await axios({

        url,

        method:
            options.method || 'GET',

        headers,

        data:
            options.data,

        timeout: 30000

    });

}

// ------------------------------------------------------------
// SAVE SESSION TO SUPABASE
// ------------------------------------------------------------

async function saveSessionToSupabase() {

    try {

        if (!fs.existsSync(SESSION_DIR)) {
            return;
        }

        const files =
            await fs.readdir(SESSION_DIR);

        if (!files.length) {
            return;
        }

        console.log(
            '📦 Saving session to Supabase...'
        );

        const zip =
            new AdmZip();

        for (const file of files) {

            const filePath =
                path.join(
                    SESSION_DIR,
                    file
                );

            const stat =
                await fs.stat(filePath);

            if (stat.isFile()) {

                zip.addLocalFile(
                    filePath,
                    '',
                    file
                );

            }

        }

        const buffer =
            zip.toBuffer();

        const base64 =
            buffer.toString('base64');

        await supabaseRequest(
            'bu_sessions',
            {
                method: 'POST',

                headers: {
                    Prefer:
                        'resolution=merge-duplicates'
                },

                data: {
                    id: SESSION_NAME,
                    data: base64
                }
            }
        );

        global.lastSessionSave =
            Date.now();

        console.log(
            '✅ Session saved to Supabase'
        );

    } catch (error) {

        console.error(
            '❌ Supabase session save failed:',
            error.response?.data ||
            error.message
        );

    }

}

// ------------------------------------------------------------
// LOAD SESSION FROM SUPABASE
// ------------------------------------------------------------

async function loadSessionFromSupabase() {

    try {

        console.log(
            '📥 Loading session from Supabase...'
        );

        const response =
            await supabaseRequest(
                `bu_sessions?id=eq.${encodeURIComponent(
                    SESSION_NAME
                )}`
            );

        if (
            response.data &&
            response.data.length > 0
        ) {

            const base64 =
                response.data[0].data;

            if (!base64) {

                console.log(
                    '⚠️ Session exists but contains no data.'
                );

                return false;
            }

            const zipBuffer =
                Buffer.from(
                    base64,
                    'base64'
                );

            const zip =
                new AdmZip(zipBuffer);

            fs.ensureDirSync(
                SESSION_DIR
            );

            zip.extractAllTo(
                SESSION_DIR,
                true
            );

            console.log(
                '✅ Session loaded from Supabase'
            );

            return true;

        }

        console.log(
            '📝 No existing session found. QR or pairing code required.'
        );

        return false;

    } catch (error) {

        console.error(
            '❌ Failed to load session:',
            error.response?.data ||
            error.message
        );

        return false;

    }

}

// ------------------------------------------------------------
// DELETE SESSION
// ------------------------------------------------------------

async function deleteSession() {

    try {

        console.log(
            '🗑️ Clearing WhatsApp session...'
        );

        await fs.emptyDir(
            SESSION_DIR
        );

        if (
            SUPABASE_URL &&
            SUPABASE_ANON_KEY
        ) {

            await supabaseRequest(
                `bu_sessions?id=eq.${encodeURIComponent(
                    SESSION_NAME
                )}`,
                {
                    method: 'DELETE'
                }
            );

        }

        console.log(
            '✅ Session cleared'
        );

    } catch (error) {

        console.error(
            '❌ Failed to clear session:',
            error.message
        );

    }

}

// ------------------------------------------------------------
// LOAD COMMANDS
// ------------------------------------------------------------

async function initializeCommands() {

    try {

        if (!global.commandsLoaded) {

            console.log(
                '📚 Loading commands...'
            );

            await loadCommands();

            global.commandsLoaded =
                true;

        }

        console.log(
            `📚 Loaded ${getAllCommands().length} commands`
        );

    } catch (error) {

        console.error(
            '❌ Command loading failed:',
            error
        );

    }

}

// ------------------------------------------------------------
// NORMALIZE PHONE NUMBER
// ------------------------------------------------------------

function cleanPhoneNumber(number) {

    return String(number || '')
        .replace(/[^0-9]/g, '');

}

// ------------------------------------------------------------
// VALIDATE PHONE NUMBER
// ------------------------------------------------------------

function validPhoneNumber(number) {

    return (
        number.length >= 10 &&
        number.length <= 15
    );

}

// ------------------------------------------------------------
// RECONNECT
// ------------------------------------------------------------

function scheduleReconnect(delay = 10000) {

    if (global.reconnectTimer) {

        clearTimeout(
            global.reconnectTimer
        );

    }

    console.log(
        `🔄 Reconnecting in ${Math.round(
            delay / 1000
        )} seconds...`
    );

    global.reconnectTimer =
        setTimeout(() => {

            global.reconnectTimer =
                null;

            startWhatsApp();

        }, delay);

}

// ------------------------------------------------------------
// START WHATSAPP
// ------------------------------------------------------------

async function startWhatsApp() {

    // Prevent duplicate sockets
    if (global.isConnecting) {

        console.log(
            '⚠️ WhatsApp connection already in progress.'
        );

        return global.whatsappSocket;

    }

    global.isConnecting = true;

    try {

        console.log(
            '🤖 Starting Adez MD Bot...'
        );

        // ----------------------------------------------------
        // LOAD SUPABASE SESSION
        // ----------------------------------------------------

        await loadSessionFromSupabase();

        fs.ensureDirSync(
            SESSION_DIR
        );

        // ----------------------------------------------------
        // AUTH STATE
        // ----------------------------------------------------

        const {
            state,
            saveCreds
        } =
            await useMultiFileAuthState(
                SESSION_DIR
            );

        // ----------------------------------------------------
        // GET CURRENT WHATSAPP WEB VERSION
        // ----------------------------------------------------

        let version;

        try {

            const latest =
                await fetchLatestBaileysVersion();

            version =
                latest.version;

            console.log(
                `📱 WhatsApp Web version: ${version.join('.')}`
            );

            if (!latest.isLatest) {

                console.warn(
                    '⚠️ Baileys bundled version is not the latest WhatsApp Web version.'
                );

            }

        } catch (error) {

            console.warn(
                '⚠️ Could not fetch latest WhatsApp Web version.'
            );

            console.warn(
                error.message
            );

            // Let Baileys use its normal default
            version = undefined;

        }

        // ----------------------------------------------------
        // CREATE SOCKET
        // ----------------------------------------------------

        const socketOptions = {

            auth: {

                creds:
                    state.creds,

                keys:
                    makeCacheableSignalKeyStore(
                        state.keys,
                        pino({
                            level: 'silent'
                        })
                    )

            },

            logger:
                pino({
                    level: 'silent'
                }),

            printQRInTerminal:
                false,

            browser:
                Browsers.ubuntu(
                    'Chrome'
                ),

            syncFullHistory:
                false,

            markOnlineOnConnect:
                false,

            generateHighQualityLinkPreview:
                true,

            fireInitQueries:
                true

        };

        if (version) {

            socketOptions.version =
                version;

        }

        const sock =
            makeWASocket(
                socketOptions
            );

        global.whatsappSocket =
            sock;

        // ----------------------------------------------------
        // SAVE CREDENTIALS
        // ----------------------------------------------------

        sock.ev.on(
            'creds.update',
            async () => {

                try {

                    await saveCreds();

                    const now =
                        Date.now();

                    if (
                        now -
                        global.lastSessionSave
                        >
                        SESSION_WRITE_INTERVAL
                    ) {

                        await saveSessionToSupabase();

                    }

                } catch (error) {

                    console.error(
                        '❌ Credential save error:',
                        error.message
                    );

                }

            }
        );

        // ----------------------------------------------------
        // CONNECTION UPDATE
        // ----------------------------------------------------

        sock.ev.on(
            'connection.update',
            async (update) => {

                const {
                    connection,
                    lastDisconnect,
                    qr,
                    isNewLogin
                } = update;

                // --------------------------------------------
                // QR CODE
                // --------------------------------------------

                if (qr) {

                    console.log(
                        '📱 QR Code generated'
                    );

                    io.emit(
                        'qr',
                        qr
                    );

                }

                // --------------------------------------------
                // NEW LOGIN
                // --------------------------------------------

                if (isNewLogin) {

                    console.log(
                        '🆕 New WhatsApp login detected.'
                    );

                }

                // --------------------------------------------
                // CONNECTING
                // --------------------------------------------

                if (
                    connection ===
                    'connecting'
                ) {

                    console.log(
                        '🔌 Connecting to WhatsApp...'
                    );

                }

                // --------------------------------------------
                // OPEN
                // --------------------------------------------

                if (
                    connection ===
                    'open'
                ) {

                    global.isConnecting =
                        false;

                    global.whatsappSocket =
                        sock;

                    console.log(
                        '✅ Adez MD connected to WhatsApp!'
                    );

                    io.emit(
                        'connected',
                        true
                    );

                    // Save immediately
                    await saveSessionToSupabase();

                    // ----------------------------------------
                    // SEND OWNER NOTIFICATION
                    // ----------------------------------------

                    try {

                        const owners = [
                            OWNER_NUMBER,
                            OWNER_NUMBER_2
                        ];

                        for (
                            const number
                            of owners
                        ) {

                            const clean =
                                cleanPhoneNumber(
                                    number
                                );

                            if (
                                !validPhoneNumber(
                                    clean
                                )
                            ) {
                                continue;
                            }

                            const jid =
                                `${clean}@s.whatsapp.net`;

                            await sock.sendMessage(
                                jid,
                                {
                                    text:
                                        `✅ *${BOT_NAME}* is now online!\n\n` +
                                        `📊 Status: Connected\n` +
                                        `🕐 Time: ${new Date().toLocaleString()}\n\n` +
                                        `Use *${PREFIX}menu* to see available commands.`
                                }
                            );

                        }

                        console.log(
                            '📩 Owner notification sent'
                        );

                    } catch (error) {

                        console.error(
                            '❌ Owner notification failed:',
                            error.message
                        );

                    }

                }

                // --------------------------------------------
                // CLOSED
                // --------------------------------------------

                if (
                    connection ===
                    'close'
                ) {

                    global.isConnecting =
                        false;

                    if (
                        global.whatsappSocke
