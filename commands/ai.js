// commands/ai.js - AI Assistant
const axios = require('axios');

module.exports = {
    name: 'ai',
    category: 'AI',
    description: 'AI assistant - chat with AI',
    run: async (sock, msg, { args, senderId, prefix }) => {
        const senderJid = msg.key.remoteJid;
        
        if (!args.length) {
            await sock.sendMessage(senderJid, {
                text: `🤖 *AI Assistant*\n\n` +
                      `*Usage:* ${prefix}ai <question>\n\n` +
                      `*Examples:*\n` +
                      `• ${prefix}ai What is the capital of Kenya?\n` +
                      `• ${prefix}ai Tell me a joke\n` +
                      `• ${prefix}ai Who created WhatsApp?\n\n` +
                      `*You can ask me anything!*`
            });
            return;
        }
        
        const question = args.join(' ');
        
        try {
            await sock.sendMessage(senderJid, {
                text: '🤖 *Thinking...*'
            });
            
            // Using free AI API
            const response = await axios.get('https://api.simsimi.vn/v1/simsimi', {
                params: {
                    text: question,
                    lc: 'en'
                }
            });
            
            const answer = response.data.response || 'Sorry, I could not answer that. Please try again.';
            
            await sock.sendMessage(senderJid, {
                text: `🤖 *AI Response:*\n\n${answer}`
            });
            
        } catch (error) {
            console.error('❌ AI error:', error.message);
            
            // Try alternative API
            try {
                const response = await axios.get('https://api.quotable.io/random');
                const quote = response.data.content;
                
                await sock.sendMessage(senderJid, {
                    text: `🤖 *AI Response:*\n\n"${quote}"\n\n- ${response.data.author}`
                });
            } catch (error2) {
                await sock.sendMessage(senderJid, {
                    text: '❌ AI is currently unavailable. Please try again later.'
                });
            }
        }
    }
};
