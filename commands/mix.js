import axios from 'axios'

export const name = 'mix'
export const category = 'download'
export const aliases = ['hearthis']
export const description = 'Fetch a mix from HearThis'

export async function run(ctx) {
  const { sock, from, m, args, prefix, reply } = ctx
  const query = args.join(' ').trim()

  if (!query) return reply(`Usage: ${prefix}mix <name or artist>`)

  try {
    const res = await axios.get('https://api-v2.hearthis.at/search', {
      params: { t: query, page: 1, count: 5 },
      timeout: 30000
    })

    const tracks = Array.isArray(res.data) ? res.data : []
    const track = tracks.find((t) => t.stream_url)
    if (!track) return reply('No mixes found.')

    await reply(`Fetching: ${track.title}\nBy: ${track.user?.username || 'Unknown'}`)

    await sock.sendMessage(
      from,
      {
        audio: { url: track.stream_url },
        mimetype: 'audio/mpeg',
        fileName: `${track.title}.mp3`
      },
      { quoted: m }
    )
  } catch (e) {
    console.log('Error in mix command:', e)
    await reply('Could not fetch the mix. Please try again later.')
  }
}
