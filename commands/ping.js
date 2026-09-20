module.exports = {
    name: 'ping',
    aliases: ['p'],
    description: 'Check if the bot is alive and see response speed',
    ownerOnly: false,

    async execute(sock, msg, ctx) {

        const start = Date.now();

        const sent = await sock.sendMessage(
            ctx.from,
            { text: '🏓 Pinging...' },
            { quoted: msg }
        );

        const ms = Date.now() - start;

        await sock.sendMessage(
            ctx.from,
            { text: `🏓 Pong! ${ms}ms` },
            { quoted: msg }
        );

    }
};
