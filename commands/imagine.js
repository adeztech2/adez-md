// commands/imagine.js - AI Image Generator
const axios = require('axios');

module.exports = {
    name: 'imagine',
    category: 'AI',
    description: 'Generate images with AI',
    run: async (sock, msg, { args, prefix }) => {
        const senderJid = msg.key.remoteJid;
        
        if (!args.length) {
            await sock.sendMessage(senderJid, {
                text: `🎨 *AI Image Generator*\n\n` +
                      `*Usage:* ${prefix}imagine <description>\n\n` +
                      `*Examples:*\n` +
                      `• ${prefix}imagine A sunset over the ocean\n` +
                      `• ${prefix}imagine A cat wearing a spacesuit`
            });
            return;
        }
        
        const prompt = args.join(' ');
        
        try {
            await sock.sendMessage(senderJid, {
                text: '🎨 *Generating image...*'
            });
            
            // Using Pollinations AI (free)
            const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
            
            await sock.sendMessage(senderJid, {
                image: {
                    url: imageUrl
                },
                caption: `🎨 *Generated Image*\n\n📝 Prompt: ${prompt}`
            });
            
        } catch (error) {
            console.error('❌ Imagine error:', error.message);
            
            await sock.sendMessage(senderJid, {
                text: '❌ Image generation failed. Please try again with a different prompt.'
            });
        }
    }
};
