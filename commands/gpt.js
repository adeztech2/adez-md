// commands/gpt.js - GPT AI Assistant
const axios = require('axios');

module.exports = {
    name: 'gpt',
    category: 'AI',
    description: 'Advanced AI - GPT powered',
    run: async (sock, msg, { args, senderId, prefix }) => {
        const senderJid = msg.key.remoteJid;
        
        if (!args.length) {
            await sock.sendMessage(senderJid, {
                text: `🧠 *GPT AI Assistant*\n\n` +
                      `*Usage:* ${prefix}gpt <question>\n\n` +
                      `*Examples:*\n` +
                      `• ${prefix}gpt Explain quantum physics\n` +
                      `• ${prefix}gpt Write a poem about love\n` +
                      `• ${prefix}gpt Give me coding tips`
            });
            return;
        }
        
        const question = args.join(' ');
        
        try {
            await sock.sendMessage(senderJid, {
                text: '🧠 *Processing...*'
            });
            
            // Using free GPT API (you can replace with your API key)
            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: 'You are a helpful assistant.' },
                    { role: 'user', content: question }
                ]
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const answer = response.data.choices[0].message.content;
            
            await sock.sendMessage(senderJid, {
                text: `🧠 *GPT Response:*\n\n${answer}`
            });
            
        } catch (error) {
            console.error('❌ GPT error:', error.message);
            
            if (error.response?.status === 401) {
                await sock.sendMessage(senderJid, {
                    text: '❌ OpenAI API key not set. Please add OPENAI_API_KEY to your environment variables.'
                });
            } else {
                await sock.sendMessage(senderJid, {
                    text: '❌ GPT is currently unavailable. Please try again later.'
                });
            }
        }
    }
};
