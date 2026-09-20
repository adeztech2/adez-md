module.exports = {
    name: 'alive',
    aliases: ['status'],
    description: 'Show bot uptime and status',
    ownerOnly: false,

    async execute(sock, msg, ctx) {

        const uptimeSeconds = process.uptime();

        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = Math.floor(uptimeSeconds % 60);

        await sock.sendMessage(
            ctx.from,
            {
                text:
                    `✅ *${ctx.botName}* is alive!\n\n` +
                    `⏱️ Uptime: ${hours}h ${minutes}m ${seconds}s\n` +
                    `📅 Time: ${new Date().toLocaleString()}`
            },
            { quoted: msg }
        );

    }
};
