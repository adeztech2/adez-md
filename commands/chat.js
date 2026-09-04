// commands/chat.js - Chat with Memory
const fs = require('fs-extra');
const path = require('path');

module.exports = {
    name: 'chat',
    category: 'AI',
    description: 'Chat with memory (remembers conversations)',
    run: async (sock, msg, { args, senderId, prefix }) => {
        const senderJid = msg.key.remoteJid;
        const memoryFile = path.join(__dirname, '../memory', `${senderId.replace(/[^a-zA-Z0-9]/g, '')}.json`);
        
        if (!args.length) {
            await sock.sendMessage(senderJid, {
                text: `💬 *Chat with Memory*\n\n` +
                      `*Usage:* ${prefix}chat <message>\n\n` +
                      `I remember our conversations! Try:\n` +
                      `• ${prefix}chat Hello, my name is John\n` +
                      `• ${prefix}chat What is my name?\n` +
                      `• ${prefix}chat clear - Clear memory`
            });
            return;
        }
        
        const userMessage = args.join(' ');
        
        // Handle clear command
        if (userMessage.toLowerCase() === 'clear') {
            await fs.remove(memoryFile);
            await sock.sendMessage(senderJid, {
                text: '🧹 Memory cleared! I will start fresh.'
            });
            return;
        }
        
        // Load memory
        let memory = {};
        try {
            if (await fs.pathExists(memoryFile)) {
                memory = await fs.readJSON(memoryFile);
            }
        } catch (error) {
            console.error('❌ Error loading memory:', error);
        }
        
        // Save conversation
        memory[senderId] = memory[senderId] || [];
        memory[senderId].push({ role: 'user', content: userMessage });
        
        // Keep last 10 messages
        if (memory[senderId].length > 10) {
            memory[senderId] = memory[senderId].slice(-10);
        }
        
        // Generate response (simple logic)
        let response = '';
        const lowerMessage = userMessage.toLowerCase();
        
        if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
            response = 'Hello! How can I help you today?';
        } else if (lowerMessage.includes('name')) {
            response = `Your name is ${memory[senderId][0]?.content.replace(/my name is /i, '') || 'unknown'}!`;
        } else if (lowerMessage.includes('how are you')) {
            response = 'I am doing great! Thank you for asking! How about you?';
        } else if (lowerMessage.includes('joke')) {
            response = 'Why did the scarecrow win an award? Because he was outstanding in his field! 🌾';
        } else if (lowerMessage.includes('time')) {
            response = `The time is ${new Date().toLocaleTimeString()}!`;
        } else if (lowerMessage.includes('date')) {
            response = `Today is ${new Date().toLocaleDateString()}!`;
        } else if (lowerMessage.includes('who are you')) {
            response = 'I am ADEZ MD - your friendly AI assistant! 🤖';
        } else if (lowerMessage.includes('thank')) {
            response = 'You are welcome! Is there anything else I can help with?';
        } else {
            response = `I understand you said: "${userMessage}". Tell me more!`;
        }
        
        // Save bot response
        memory[senderId].push({ role: 'bot', content: response });
        
        // Save memory
        try {
            await fs.ensureDir(path.dirname(memoryFile));
            await fs.writeJSON(memoryFile, memory);
        } catch (error) {
            console.error('❌ Error saving memory:', error);
        }
        
        await sock.sendMessage(senderJid, {
            text: `💬 *AI Chat:*\n\n${response}`
        });
    }
};
