const axios = require('axios');

module.exports.name = "mix";
module.exports.category = "Downloader";

module.exports.execute = async function (sock, msg, ctx) {
  const query = ctx.args.join(' ');

  if (!query) {
    return sock.sendMessage(
      ctx.from,
      { text: "❌ Usage: .mix <song or artist name>\nExample: .mix lofi chill" },
      { quoted: msg }
    );
  }

  await sock.sendMessage(ctx.from, { text: `🔎 Searching hearthis.at for "${query}"...` }, { quoted: msg });

  try {
    // hearthis.at public search API
    const searchRes = await axios.get('https://api-v2.hearthis.at/searches/1/', {
      params: { t: query }
    });

    const results = searchRes.data;

    if (!results || results.length === 0) {
      return sock.sendMessage(ctx.from, { text: `❌ No results found for "${query}".` }, { quoted: msg });
    }

    const track = results[0]; // take the top match

    const title = track.title || 'Unknown title';
    const artist = track.user?.username || 'Unknown artist';
    const duration = track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}` : 'N/A';
    const downloadUrl = track.download_url || track.stream_url;

    if (!downloadUrl) {
      return sock.sendMessage(ctx.from, { text: `⚠️ Found "${title}" but no downloadable link is available for it.` }, { quoted: msg });
    }

    await sock.sendMessage(
      ctx.from,
      {
        audio: { url: downloadUrl },
        mimetype: 'audio/mpeg',
        fileName: `${title}.mp3`,
        caption: `🎵 *${title}*\n👤 ${artist}\n⏱ ${duration}`
      },
      { quoted: msg }
    );
  } catch (err) {
    console.error('❌ mix command error:', err.message);
    await sock.sendMessage(
      ctx.from,
      { text: `❌ Failed to fetch from hearthis.at: ${err.message}` },
      { quoted: msg }
    );
  }
};
