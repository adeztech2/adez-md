// observers/logger.js - Message Logger
module.exports = {
    name: 'logger',
    run: async (sock, msg) => {
        const body = msg.message?.conversation || 
                    msg.message?.extendedTextMessage?.text || '';
        
        if (body) {
            const senderJid = msg.key.remoteJid;
            const senderId = msg.key.participant || senderJid;
            
            console.log(`📩 Message from ${senderId}: ${body.substring(0, 50)}...`);
        }
    }
};
