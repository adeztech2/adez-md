// commands/play2.js - Music Player (ytdl-core)
const ytdl = require('ytdl-core');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
    name: 'play2',
    category: 'Downloader',
    description: 'Download music using ytdl-core',
    run: async (sock, msg, { args }) => {
        const senderJid = msg.key.remoteJid;
        
        if (!args.length) {
            await sock.sendMessage(senderJid, {
                text: `🎵 *PLAY2 COMMAND*\n\n` +
                      `*Usage:* .play2 <youtube_url>\n\n` +
                      `*Example:* .play2 https://youtube.com/watch?v=xxxx`
            });
            return;
        }
        
        const url = args[0];
        
        try {
            await sock.sendMessage(senderJid, {
                text: '🎵 *Downloading...*'
            });
            
            // Get video info
            const info = await ytdl.getInfo(url);
            const title = info.videoDetails.title;
            
            // Download audio
            const audioStream = ytdl(url, {
                filter: 'audioonly',
                quality: 'highestaudio'
            });
            
            // Save temporary file
            const tempFile = path.join(__dirname, '../temp', `${Date.now()}.mp3`);
            await fs.ensureDir(path.dirname(tempFile));
            
            const writeStream = fs.createWriteStream(tempFile);
            audioStream.pipe(writeStream);
            
            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });
            
            // Send audio file
            await sock.sendMessage(senderJid, {
                audio: {
                    url: tempFile
                },
                mimetype: 'audio/mp4',
                caption: `🎵 *${title}*\n\n📥 Downloaded by ADEZ MD`
            });
            
            // Clean up
            await fs.remove(tempFile);
            
        } catch (error) {
            console.error('❌ Play2 error:', error.message);
            
            await sock.sendMessage(senderJid, {
                text: '❌ Failed to download. Make sure the URL is a valid YouTube link.'
            });
        }
    }
};
