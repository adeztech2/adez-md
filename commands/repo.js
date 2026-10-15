import { box, botName } from '../lib/style.js'

export const name = 'repo'
export const category = 'general'
export const aliases = ['script', 'sc']
export const description = 'Show the bot repository'

// Change these in Render (Environment) if the repo moves:
//   GITHUB_REPO = owner/name  (default adeztech2/adez-md)
//   REPO_IMAGE  = a direct link to the banner picture (.jpg or .png)
const REPO = process.env.GITHUB_REPO || 'adeztech2/adez-md'

const num = (jid = '') => String(jid).split('@')[0].split(':')[0]

// GitHub only allows 60 requests an hour, so keep the answer for 10 minutes
let cache = null
async function getRepo() {
  if (cache && Date.now() - cache.time < 10 * 60 * 1000) return cache.data
  const res = await fetch(`https://api.github.com/repos/${REPO}`, {
    headers: { 'User-Agent': 'adez-md-bot', Accept: 'application/vnd.github+json' }
  })
  if (!res.ok) throw new Error(`GitHub said ${res.status}`)
  const data = await res.json()
  cache = { data, time: Date.now() }
  return data
}

const when = (iso) =>
  new Date(iso).toLocaleString('en-GB', { timeZone: 'Africa/Nairobi', hour12: false })

export async function run({ sock, m, from, sender, reply }) {
  let rows
  try {
    const r = await getRepo()
    rows = [
      ['name', r.name],
      ['owner', r.owner?.login || 'Arnold Adez'],
      ['stars', `${r.stargazers_count} ⭐`],
      ['forks', `${r.forks_count} 🍴`],
      ['watchers', `${r.subscribers_count ?? r.watchers_count} 👁️`],
      ['size', `${(r.size / 1024).toFixed(2)} MB`],
      ['updated', when(r.pushed_at || r.updated_at)],
      ['repo', r.html_url],
      ['description', r.description || 'A powerful WhatsApp bot']
    ]
  } catch (e) {
    console.log('repo command: could not read GitHub:', e.message)
    rows = [
      ['name', 'adez-md'],
      ['owner', 'Arnold Adez'],
      ['repo', `https://github.com/${REPO}`]
    ]
  }

  const text = box(`${botName()} REPO`, [
    ...rows,
    `Hey @${num(sender)} 👋`,
    "Don't forget 🎉",
    'to fork and star the repo! ⭐'
  ])
  const mentions = [sender]

  const image = process.env.REPO_IMAGE
  if (image) {
    try {
      await sock.sendMessage(from, { image: { url: image }, caption: text, mentions }, { quoted: m })
      return
    } catch (e) {
      console.log('repo command: picture failed, sending text only:', e.message)
    }
  }
  await sock.sendMessage(from, { text, mentions }, { quoted: m })
}
