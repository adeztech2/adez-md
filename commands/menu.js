// commands/menu.js - Main Menu Command
module.exports = {
    name: 'menu',
    category: 'General',
    description: 'Shows the bot menu',
    run: async (sock, msg, { args, prefix, commands }) => {
        const senderJid = msg.key.remoteJid;
        
        // Create menu text
        let menuText = `╭━━━〔 *ADEZ MD* 〕━━━⬣\n`;
        menuText += `┃\n`;
        menuText += `┃  👋 Hello! Welcome to *Adez MD*\n`;
        menuText += `┃  📊 Status: Online\n`;
        menuText += `┃  📚 Total Commands: ${commands.length}\n`;
        menuText += `┃\n`;
        menuText += `╰━━━━━━━━━━━━━━━⬣\n\n`;
        
        menuText += `╭━━━〔 *COMMANDS* 〕━━━⬣\n`;
        
        // Group commands by category
        const categories = {};
        commands.forEach(cmd => {
            if (!categories[cmd.category]) {
                categories[cmd.category] = [];
            }
            categories[cmd.category].push(cmd);
        });
        
        for (const [category, cmds] of Object.entries(categories)) {
            menuText += `┃\n`;
            menuText += `┃  📁 *${category.toUpperCase()}*\n`;
            menuText += `┃\n`;
            cmds.forEach(cmd => {
                menuText += `┃  ${prefix}${cmd.name} - ${cmd.description}\n`;
            });
        }
        
        menuText += `┃\n`;
        menuText += `╰━━━━━━━━━━━━━━━⬣\n\n`;
        
        menuText += `╭━━━〔 *INFO* 〕━━━⬣\n`;
        menuText += `┃\n`;
        menuText += `┃  📱 Prefix: ${prefix}\n`;
        menuText += `┃  🤖 Bot: Adez MD\n`;
        menuText += `┃\n`;
        menuText += `╰━━━━━━━━━━━━━━━⬣`;
        
        await sock.sendMessage(senderJid, {
            text: menuText
        });
    }
};
