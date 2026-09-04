// commands/mix.js - Download from Hearthis.at
const axios = require('axios');
const fs = require('fs-extra');

module.exports = {
    name: 'mix',
    category: 'Downloader',
    description: 'Download a track from Hearthis.at',
    run: async (sock, msg, { args }) => {
        const senderJid = msg.key.remoteJid;

        if (!args[0]) {
            await sock.sendMessage(senderJid, {
                text: `🎵 *MIX COMMAND*\n\n*Usage:* .mix <hearthis.at_url>\n\n*Example:* .mix https://hearthis.at/artist-name/track-name`
            });
            return;
        }

        const url = args[0];

        if (!url.includes('hearthis.at')) {
            await sock.sendMessage(senderJid, { text: '❌ Please provide a valid Hearthis.at URL.' });
            return;
        }

        try {
            await sock.sendMessage(senderJid, { text: '⏳ *Downloading track from Hearthis.at...*' });

            // Construct the direct download URL
            const downloadUrl = url.replace(/\/?$/, '/download/');

            // Validate the URL by making a HEAD request
            await axios.head(downloadUrl);
            
            // Send the audio file to WhatsApp
            await sock.sendMessage(senderJid, {
                audio: { url: downloadUrl },
                mimetype: 'audio/mp4',
                caption: `🎵 *Downloaded from Hearthis.at*\n\nPowered by *ADEZ MD*`
            });

        } catch (error) {
            console.error('❌ Mix command error:', error.message);
            await sock.sendMessage(senderJid, {
                text: '❌ Could not download track. The creator may have disabled downloads, or the URL is invalid.'
            });
        }
    }
};
