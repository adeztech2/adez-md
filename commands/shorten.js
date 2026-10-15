import { box } from '../lib/style.js'

export const name = 'shorten'
export const category = 'tools'
export const aliases = ['short']
export const description = 'Shorten a link: .shorten https://example.com/long'

export async function run({ args, reply, prefix }) {
  const link = args[0]
  if (!link || !/^https?:\/\//i.test(link)) {
    return reply(box('SHORTEN', [`Use: ${prefix}shorten https://example.com/very/long/link`]))
  }
  try {
    const res = await fetch('https://tinyurl.com/api-create.php?url=' + encodeURIComponent(link))
    const short = (await res.text()).trim()
    if (!short.startsWith('http')) throw new Error('bad reply')
    return reply(box('SHORTEN', [['short link', short]]))
  } catch {
    return reply(box('SHORTEN', ['Could not shorten that link right now. Try again later.']))
  }
}
