// index.js - Adez MD Bot Main File
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const AdmZip = require('adm-zip');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');

// Import router
const { loadCommands, getAllCommands } = require('./lib/router');

// Configuration
const PORT = process.env.PORT || 3000;
const BOT_NAME = process.env.BOT_NAME || 'Adez MD';
const OWNER_NUMBER = process.env.OWNER_NUMBER || '254101579396';
const PREFIX = process.env.PREFIX || '.';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SESSION_NAME = process.env.SESSION_NAME || 'adez-md-session';
const SESSION_WRITE_INTERVAL = parseInt(process.env.SESSION_WRITE_INTERVAL) || 120000; // 2 minutes

// Create Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static('public'));

// Health endpoint for UptimeRobot
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        bot: BOT_NAME,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Supabase helpers
async function supabaseRequest(endpoint, options = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    const response = await axios({
        url,
        method: options.method || 'GET',
        headers,
        data: options.data
    });
    
    return response;
}

// Session management functions
async function saveSessionToSupabase(sessionDir) {
    try {
        console.log('📦 Saving session to Supabase...');
        
        // Create zip of session folder
        const zip = new AdmZip();
        const sessionFiles = fs.readdirSync(sessionDir);
        
        for (const file of sessionFiles) {
            const filePath = path.join(sessionDir, file);
            if (fs.statSync(filePath).isFile()) {
                zip.addLocalFile(filePath, '', file);
            }
        }
        
        const zipBuffer = zip.toBuffer();
        const base64Data = zipBuffer.toString('base64');
        
        // Save to Supabase
        await supabaseRequest('bu_sessions', {
            method: 'POST',
            headers: {
                'Prefer': 'resolution=merge-duplicates'
            },
            data: {
                id: SESSION_NAME,
                data: base64Data
            }
        });
        
        console.log('✅ Session saved to Supabase successfully');
    } catch (error) {
        console.error('❌ Failed to save session:', error.message);
    }
}

async function loadSessionFromSupabase() {
    try {
        console.log('📥 Loading session from Supabase...');
        
        const response = await supabaseRequest(`bu_sessions?id=eq.${SESSION_NAME}`);
        
        if (response.data && response.data.length > 0) {
            const base64Data = response.data[0].data;
            const zipBuffer = Buffer.from(base64Data, 'base64');
            const zip = new AdmZip(zipBuffer);
            
            // Extract to session folder
            const sessionDir = path.join(__dirname, 'session');
            fs.ensureDirSync(sessionDir);
            zip.extractAllTo(sessionDir, true);
            
            console.log('✅ Session loaded from Supabase');
            return true;
        }
        
        console.log('📝 No existing session found. Will need to scan QR.');
        return false;
    } catch (error) {
        console.error('❌ Failed to load session:', error.message);
        return false;
    }
}

// Start WhatsApp connection
async function startWhatsApp() {
    console.log('🤖 Starting Adez MD Bot...');
    
    // Load saved session if exists
    await loadSessionFromSupabase();
    
    // Setup auth state
    const sessionDir = path.join(__dirname, 'session');
    fs.ensureDirSync(sessionDir);
    
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    
    // Get latest Baileys version
    const { version } = await fetchLatestBaileysVersion();
    console.log(`📱 Using Baileys version: ${version}`);
    
    // Create WhatsApp socket
    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // We'll show QR via web
        browser: ['Adez MD', 'Chrome', '20.11.1'],
        syncFullHistory: false, // Prevent syncing loops
        fireInitQueries: false // Prevent init loops
    });
    
    // Load commands
    await loadCommands();
    console.log(`📚 Loaded ${getAllCommands().length} commands`);
    
    // Send confirmation to owner on connect
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('📱 QR Code generated');
            io.emit('qr', qr);
        }
        
        if (connection === 'open') {
            console.log('✅ Bot Connected to WhatsApp!');
            io.emit('connected', true);
            
            // Send confirmation message to owner
            try {
                const ownerJid = `${OWNER_NUMBER}@s.whatsapp.net`;
                await sock.sendMessage(ownerJid, {
                    text: `✅ *${BOT_NAME}* is now online!\n\n📊 Status: Connected\n🕐 Time: ${new Date().toLocaleString()}\n\nUse *.menu* to see available commands!`
                });
                console.log('📩 Confirmation message sent to owner');
            } catch (error) {
                console.error('❌ Failed to send confirmation:', error.message);
            }
        }
        
        // Handle disconnections
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const errorMessage = lastDisconnect?.error?.message;
            
            console.log(`❌ Connection closed. Status: ${statusCode}`);
            
            // Conflict detection - prevent duplicate sessions
            if (errorMessage && errorMessage.includes('conflict')) {
                console.log('⚠️ STREAM ERRORED CONFLICT DETECTED!');
                console.log('🔄 Another instance is running. Exiting...');
                await sock.logout();
                process.exit(1);
            }
            
            // Reconnection logic
            if (statusCode === DisconnectReason.loggedOut) {
                console.log('📴 Bot logged out. Clearing session...');
                fs.emptyDirSync(sessionDir);
                await supabaseRequest(`bu_sessions?id=eq.${SESSION_NAME}`, {
                    method: 'DELETE'
                });
                console.log('🔄 Restarting for fresh QR scan...');
                startWhatsApp();
            } else if (statusCode === DisconnectReason.restartRequired) {
                console.log('🔄 Restart required. Restarting...');
                startWhatsApp();
            } else if (statusCode === DisconnectReason.badSession) {
                console.log('⚠️ Bad session detected. Clearing and restarting...');
                fs.emptyDirSync(sessionDir);
                await supabaseRequest(`bu_sessions?id=eq.${SESSION_NAME}`, {
                    method: 'DELETE'
                });
                startWhatsApp();
            } else {
                console.log('🔄 Reconnecting in 5 seconds...');
                setTimeout(() => startWhatsApp(), 5000);
            }
        }
    });
    
    // Save credentials periodically
    sock.ev.on('creds.update', async () => {
        try {
            await saveCreds();
            
            // Throttle Supabase writes to max once per 2 minutes
            const now = Date.now();
            if (!global.lastSessionSave || (now - global.lastSessionSave > SESSION_WRITE_INTERVAL)) {
                global.lastSessionSave = now;
                await saveSessionToSupabase(sessionDir);
            }
        } catch (error) {
            console.error('❌ Failed to save credentials:', error.message);
        }
    });
    
    // Message handling
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        
        for (const msg of messages) {
            if (!msg.message) continue;
            if (msg.key.fromMe) continue; // Skip own messages
            
            // Process commands
            try {
                const { processCommand } = require('./lib/router');
                await processCommand(sock, msg);
            } catch (error) {
                console.error('❌ Error processing command:', error);
            }
        }
    });
    
    return sock;
}

// Start everything
async function main() {
    console.log('🚀 Starting Adez MD Server...');
    
    // Start Express server
    server.listen(PORT, () => {
        console.log(`🌐 Server running on http://localhost:${PORT}`);
        console.log(`📱 Open http://localhost:${PORT}/pair.html to see QR code`);
    });
    
    // Start WhatsApp
    startWhatsApp();
}

// Handle process errors
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled Rejection:', error);
});

// Start the bot
main();
