import { box, botName } from '../lib/style.js'

export const name = 'imagine'
export const category = 'ai'
export const aliases = ['image', 'draw']
export const description = 'Create an AI image from text'

export async function run({ sock, from, m, args, prefix, reply }) {
  const prompt = args.join(' ').trim()
  if (!prompt) return reply(box('IMAGINE', [['usage', `${prefix}imagine a lion in space`]]))

  try {
    await reply(box('IMAGINE', [['status', 'Creating image... ⏳']]))
    const seed = Math.floor(Math.random() * 100000)
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&nologo=true&seed=${seed}`
    await sock.sendMessage(from, {
      image: { url },
      caption: box(`${botName()} IMAGINE`, [['prompt', prompt]])
    }, { quoted: m })
  } catch (e) {
    console.log('Imagine failed:', e.message)
    await reply(box('IMAGINE', ['Could not create the image.']))
  }
}
