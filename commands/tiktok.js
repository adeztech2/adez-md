module.exports.name = "tiktok";
module.exports.category = "Downloader";

module.exports.execute = async function (sock, msg, ctx) {
  await sock.sendMessage(ctx.from, { text: "TikTok downloader placeholder — logic goes here." }, { quoted: msg });
};
