module.exports.name = "ping";
module.exports.category = "General";

module.exports.execute = async function (sock, msg, ctx) {
  const start = Date.now();

  const sent = await sock.sendMessage(
    ctx.from,
    { text: "🏓 Pinging..." },
    { quoted: msg }
  );

  const latency = Date.now() - start;

  await sock.sendMessage(
    ctx.from,
    { text: `🏓 Pong! Response time: ${latency}ms` },
    { quoted: msg, edit: sent.key }
  );
};
