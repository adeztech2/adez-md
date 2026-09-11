export const name = "tiktok";
export const category = "Downloader";

export async function execute(sock, msg, ctx) {
  await sock.sendMessage(ctx.from, { text: "TikTok downloader placeholder — logic goes here." }, { quoted: msg });
}
