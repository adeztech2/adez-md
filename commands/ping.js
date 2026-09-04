// commands/ping.js - Ping Command
module.exports = {
    name: 'ping',
    category: 'General',
    description: 'Checks bot response time',
    run: async (sock, msg) => {
        const senderJid = msg.key.remoteJid;
        const start = Date.now();
        
        await sock.sendMessage(senderJid, {
            text: '🏓 Pinging...'
        });
        
        const end = Date.now();
        const responseTime = end - start;
        
        await sock.sendMessage(senderJid, {
            text: `⚡ *Pong!*\n\n📊 Response Time: ${responseTime}ms`
        });
    }
};
