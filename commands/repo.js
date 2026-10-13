export const name = 'repo'
export const category = 'general'
export const aliases = ['script', 'source']
export const description = 'Show the bot repository link'

const REPO_URL = 'https://github.com/adeztech2/adez-md'

function uptime() {
  const s = Math.floor(process.uptime())
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${m}m`
}

export async function run({ sock, from, m, reply, prefix }) {
  const botName = process.env.BOT_NAME || 'ADEZ MD'

  let text = `╔═══════════════╗\n`
  text += `   🤖 *${botName}*\n`
  text += `╚═══════════════╝\n\n`
  text += `📂 *Repository*\n`
  text += `${REPO_URL}\n\n`
  text += `👨‍💻 *Developer*\n`
  text += `Arnold Adez\n`
  text += `wa.me/254111783552\n\n`
  text += `📊 *Status*\n`
  text += `▸ Uptime: ${uptime()}\n`
  text += `▸ Prefix: ${prefix}\n`
  text += `▸ Host: Render\n\n`
  text += `⭐ _Don't forget to star and fork the repo!_`

  const image = process.env.MENU_IMAGE
  if (image) {
    try {
      await sock.sendMessage(from, { image: { url: image }, caption: text }, { quoted: m })
      return
    } catch (e) {
      console.log('Repo image failed, sending text only:', e.message)
    }
  }

  await reply(text)
  }
