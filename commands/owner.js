// commands/owner.js - Owner Only Command
module.exports = {
    name: 'owner',
    category: 'Owner',
    description: 'Shows bot owner info',
    ownerOnly: true,
    run: async (sock, msg) => {
        const senderJid = msg.key.remoteJid;
        
        const ownerText = `╭━━━〔 *OWNER INFO* 〕━━━⬣\n`;
        ownerText += `┃\n`;
        ownerText += `┃  👑 Owner: Adez MD\n`;
        ownerText += `┃  📱 Number: wa.me/254101579396\n`;
        ownerText += `┃\n`;
        ownerText += `╰━━━━━━━━━━━━━━━⬣`;
        
        await sock.sendMessage(senderJid, {
            text: ownerText
        });
    }
};
