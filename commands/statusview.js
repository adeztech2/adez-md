// commands/statusview.js - Auto Status Viewer
module.exports = {
    name: 'statusview',
    category: 'Status',
    description: 'Auto view status updates',
    ownerOnly: true,
    run: async (sock, msg, { args }) => {
        const senderJid = msg.key.remoteJid;
        
        if (!args[0]) {
            await sock.sendMessage(senderJid, {
                text: `👁️ *AUTO STATUS VIEW*\n\n` +
                      `*Commands:*\n` +
                      `• .statusview on - Enable auto view\n` +
                      `• .statusview off - Disable auto view\n` +
                      `• .statusview status - Check status\n\n` +
                      `*What it does:*\n` +
                      `Automatically views status updates from your contacts!`
            });
            return;
        }
        
        const action = args[0].toLowerCase();
        
        switch (action) {
            case 'on':
                global.autoStatusView = true;
                await sock.sendMessage(senderJid, {
                    text: '✅ Auto status view ENABLED!\n\nI will automatically view status updates from your contacts.'
                });
                break;
                
            case 'off':
                global.autoStatusView = false;
                await sock.sendMessage(senderJid, {
                    text: '❌ Auto status view DISABLED!\n\nI will no longer view status updates.'
                });
                break;
                
            case 'status':
                const status = global.autoStatusView ? '✅ ENABLED' : '❌ DISABLED';
                await sock.sendMessage(senderJid, {
                    text: `👁️ *STATUS VIEW STATUS*\n\n🔴 Status: ${status}`
                });
                break;
                
            default:
                await sock.sendMessage(senderJid, {
                    text: '❌ Unknown action!\n\nUse .statusview on / off / status'
                });
        }
    }
};
