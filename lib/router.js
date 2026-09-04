// lib/router.js - Command Router for Adez MD
const fs = require('fs-extra');
const path = require('path');
const { pathToFileURL } = require('url');

// Store all loaded commands
const commands = new Map();
const observers = new Map();

// Recursive command loader
async function loadCommands(dir = path.join(__dirname, '../commands')) {
    console.log('📚 Loading commands...');
    
    try {
        // Ensure directory exists
        await fs.ensureDir(dir);
        
        // Read all files in directory
        const files = await fs.readdir(dir);
        
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = await fs.stat(filePath);
            
            if (stat.isDirectory()) {
                // Recursively load commands from subdirectories
                await loadCommands(filePath);
            } else if (file.endsWith('.js')) {
                try {
                    // Load command module
                    const moduleURL = pathToFileURL(filePath).href;
                    const module = await import(moduleURL);
                    const command = module.default || module;
                    
                    // Check if command has required properties
                    if (command.name && command.run) {
                        // Duplicate command check
                        if (commands.has(command.name)) {
                            console.log(`⚠️ Duplicate command "${command.name}" skipped! (Already loaded from ${commands.get(command.name).filePath})`);
                            continue;
                        }
                        
                        // Store command
                        commands.set(command.name, {
                            ...command,
                            filePath,
                            category: command.category || 'General',
                            description: command.description || 'No description'
                        });
                        
                        console.log(`✅ Loaded: ${command.name} [${command.category || 'General'}]`);
                    } else {
                        console.log(`⚠️ Skipped ${file} - Missing "name" or "run" property`);
                    }
                } catch (error) {
                    console.error(`❌ FAILED to load ${file}:`, error);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading commands:', error);
    }
    
    console.log(`📊 Total commands loaded: ${commands.size}`);
}

// Load observers
async function loadObservers(dir = path.join(__dirname, '../observers')) {
    console.log('👁️ Loading observers...');
    
    try {
        await fs.ensureDir(dir);
        
        const files = await fs.readdir(dir);
        
        for (const file of files) {
            if (file.endsWith('.js')) {
                try {
                    const filePath = path.join(dir, file);
                    const moduleURL = pathToFileURL(filePath).href;
                    const module = await import(moduleURL);
                    const observer = module.default || module;
                    
                    if (observer.name && observer.run) {
                        observers.set(observer.name, {
                            ...observer,
                            filePath
                        });
                        
                        console.log(`✅ Loaded observer: ${observer.name}`);
                    }
                } catch (error) {
                    console.error(`❌ FAILED to load observer ${file}:`, error);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading observers:', error);
    }
}

// LID to JID resolver (converts @lid to @s.whatsapp.net)
function lidToJid(lid) {
    if (!lid) return null;
    
    // Remove @lid if present
    const cleanLid = lid.replace('@lid', '');
    
    // Return as WhatsApp JID
    return `${cleanLid}@s.whatsapp.net`;
}

// Admin check function
async function checkAdmin(sock, groupMetadata, participantId) {
    try {
        if (!groupMetadata || !groupMetadata.participants) {
            return { isAdmin: false, isBotAdmin: false };
        }
        
        const participant = groupMetadata.participants.find(
            p => p.id === participantId || p.id === participantId.split('@')[0] + '@s.whatsapp.net'
        );
        
        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const botParticipant = groupMetadata.participants.find(
            p => p.id === botId
        );
        
        return {
            isAdmin: participant ? (participant.admin === 'admin' || participant.admin === 'superadmin') : false,
            isBotAdmin: botParticipant ? (botParticipant.admin === 'admin' || botParticipant.admin === 'superadmin') : false
        };
    } catch (error) {
        console.error('❌ Error checking admin:', error);
        return { isAdmin: false, isBotAdmin: false };
    }
}

// Process incoming command
async function processCommand(sock, msg) {
    try {
        const body = msg.message?.conversation || 
                    msg.message?.extendedTextMessage?.text || 
                    msg.message?.imageMessage?.caption || 
                    msg.message?.videoMessage?.caption || '';
        
        if (!body) return;
        
        // Check if message starts with prefix
        const prefix = process.env.PREFIX || '.';
        if (!body.startsWith(prefix)) return;
        
        // Extract command and args
        const args = body.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        
        if (!commandName) return;
        
        // Check if command exists
        if (!commands.has(commandName)) {
            console.log(`❌ Command not found: ${commandName}`);
            return;
        }
        
        const command = commands.get(commandName);
        
        // Get sender info
        const senderJid = msg.key.remoteJid;
        const isGroup = senderJid.endsWith('@g.us');
        const senderId = msg.key.participant || senderJid;
        
        console.log(`📝 Processing command: ${commandName} from ${senderId}`);
        
        // Get group metadata if in group
        let groupMetadata = null;
        let isAdmin = false;
        let isBotAdmin = false;
        
        if (isGroup) {
            try {
                groupMetadata = await sock.groupMetadata(senderJid);
                const adminStatus = await checkAdmin(sock, groupMetadata, senderId);
                isAdmin = adminStatus.isAdmin;
                isBotAdmin = adminStatus.isBotAdmin;
            } catch (error) {
                console.error('❌ Error getting group metadata:', error);
            }
        }
        
        // Check if command is owner-only
        const ownerNumber = process.env.OWNER_NUMBER || '254101579396';
        const isOwner = senderId.includes(ownerNumber);
        
        if (command.ownerOnly && !isOwner) {
            await sock.sendMessage(senderJid, {
                text: '❌ This command is for the owner only!'
            });
            return;
        }
        
        // Check if command requires admin
        if (command.adminOnly && !isAdmin) {
            await sock.sendMessage(senderJid, {
                text: '❌ This command requires admin privileges!'
            });
            return;
        }
        
        // Check if command requires bot admin
        if (command.botAdmin && !isBotAdmin) {
            await sock.sendMessage(senderJid, {
                text: '❌ I need to be admin to use this command!'
            });
            return;
        }
        
        // Run the command
        try {
            await command.run(sock, msg, {
                args,
                senderId,
                isGroup,
                isOwner,
                isAdmin,
                isBotAdmin,
                groupMetadata,
                prefix,
                commands: getAllCommands()
            });
            
            console.log(`✅ Command executed: ${commandName}`);
        } catch (error) {
            console.error(`❌ FAILED ${commandName}:`, error);
            console.error('Error stack:', error.stack);
            
            // Send error message to user
            await sock.sendMessage(senderJid, {
                text: `❌ Error executing command: ${commandName}\n\n📋 Error: ${error.message}`
            }).catch(e => console.error('Failed to send error message:', e));
        }
    } catch (error) {
        console.error('❌ Error in processCommand:', error);
    }
}

// Get all commands
function getAllCommands() {
    return Array.from(commands.values());
}

// Get command by name
function getCommand(name) {
    return commands.get(name);
}

// Run observers
async function runObservers(sock, msg) {
    for (const observer of observers.values()) {
        try {
            await observer.run(sock, msg);
        } catch (error) {
            console.error(`❌ Observer ${observer.name} failed:`, error);
        }
    }
}

// Export functions
module.exports = {
    loadCommands,
    loadObservers,
    processCommand,
    getAllCommands,
    getCommand,
    runObservers,
    lidToJid,
    checkAdmin
};
