// commands/play.js - Music Player
const axios = require('axios');

module.exports = {
    name: 'play',
    category: 'Downloader',
    description: 'Download and play music from YouTube',
    run: async (sock, msg, { args }) => {
        const senderJid = msg.key.remoteJid;
        
        if (!args.length) {
            await sock.sendMessage(senderJid, {
                text: `🎵 *PLAY COMMAND*\n\n` +
                      `*Usage:* .play <song name>\n\n` +
                      `*Examples:*\n` +
                      `• .play Alan Walker Faded\n` +
                      `• .play Ed Sheeran Shape of You\n` +
                      `• .play Kenyan Gospel Songs\n\n` +
                      `I will search YouTube and download the song for you!`
            });
            return;
        }
        
        const query = args.join(' ');
        
        try {
            await sock.sendMessage(senderJid, {
                text: `🎵 *Searching for:* ${query}\n\n⏳ Downloading...`
            });
            
            // Search YouTube and download using y2mate
            const response = await axios.post('https://api.y2mate.com/mate/convert', {
                url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
                format: 'mp3',
                quality: '128kbps'
            });
            
            const songUrl = response.data.result.url;
            const songTitle = response.data.title || query;
            
            // Send audio file
            await sock.sendMessage(senderJid, {
                audio: {
                    url: songUrl
                },
                mimetype: 'audio/mp4',
                caption: `🎵 *${songTitle}*\n\n📥 Downloaded by ADEZ MD`
            });
            
        } catch (error) {
            console.error('❌ Play command error:', error.message);
            
            // Try alternative API
            try {
                const response = await axios.get('https://api.napster.com/v2.2/search/advanced', {
                    params: {
                        query: query,
                        apikey: process.env.NAPSTER_API_KEY || 'YOUR_NAPSTER_KEY'
                    }
                });
                
                const songUrl = response.data.search.data.tracks[0].previewURL;
                const songTitle = response.data.search.data.tracks[0].name;
                
                await sock.sendMessage(senderJid, {
                    audio: {
                        url: songUrl
                    },
                    mimetype: 'audio/mp4',
                    caption: `🎵 *${songTitle}*\n\n📥 Downloaded by ADEZ MD`
                });
            } catch (error2) {
                await sock.sendMessage(senderJid, {
                    text: '❌ Could not download the song. Please try a different song or check your internet connection.'
                });
            }
        }
    }
};
