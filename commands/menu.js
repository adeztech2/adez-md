module.exports = {
    name: 'menu',
    aliases: ['help', 'commands'],
    description: 'List all available commands',
    ownerOnly: false,

    async execute(sock, msg, ctx) {

        // Lazy require to avoid a circular dependency with router.js
        const { getAllCommands } = require('../router');

        const commands = getAllCommands()
            .sort((a, b) => a.name.localeCompare(b.name));

        const lines = commands.map(
            (cmd) => `▸ *${ctx.prefix}${cmd.name}* — ${cmd.description || 'No description'}`
        );

        await sock.sendMessage(
            ctx.from,
            {
                text:
                    `📋 *${ctx.botName} — Command Menu*\n\n` +
                    lines.join('\n') +
                    `\n\nTotal: ${commands.length} commands`
            },
            { quoted: msg }
        );

    }
};
