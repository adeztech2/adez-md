// Handle socket events for pair code
io.on('connection', (socket) => {
    console.log('📱 Client connected to pair page');
    
    socket.on('request-pair-code', async () => {
        console.log('📱 Pair code requested');
        try {
            // Create a new socket for pair code
            const sessionDir = path.join(__dirname, 'session');
            fs.ensureDirSync(sessionDir);
            
            const { state } = await useMultiFileAuthState(sessionDir);
            const { version } = await fetchLatestBaileysVersion();
            
            const tempSock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
                },
                logger: pino({ level: 'silent' }),
                browser: ['Adez MD', 'Chrome', '20.11.1'],
                syncFullHistory: false,
                fireInitQueries: false
            });
            
            // Listen for pairing code
            tempSock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;
                
                if (connection === 'open') {
                    console.log('✅ Pair code connection successful!');
                    io.emit('connected', true);
                }
                
                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    if (statusCode !== DisconnectReason.loggedOut) {
                        console.log('🔄 Pair code connection closed. Restarting main bot...');
                        // Restart main bot with new session
                        setTimeout(() => {
                            startWhatsApp();
                        }, 3000);
                    }
                }
            });
            
            // Request pairing code
            setTimeout(async () => {
                try {
                    const phoneNumber = OWNER_NUMBER.replace(/[^0-9]/g, '');
                    const pairingCode = await tempSock.requestPairingCode(phoneNumber);
                    console.log(`📱 Pair code generated: ${pairingCode}`);
                    io.emit('pair-code', pairingCode);
                } catch (error) {
                    console.error('❌ Failed to generate pair code:', error.message);
                    io.emit('error', 'Failed to generate pair code');
                }
            }, 3000);
            
        } catch (error) {
            console.error('❌ Pair code error:', error);
            io.emit('error', error.message);
        }
    });
    
    socket.on('reconnect-request', () => {
        console.log('🔄 Reconnect requested');
        io.emit('reconnecting', true);
        setTimeout(() => {
            startWhatsApp();
        }, 2000);
    });
});
