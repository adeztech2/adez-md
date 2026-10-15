import { translate as gtranslate } from '@vitalets/google-translate-api'
import { box } from '../lib/style.js'

export const name = 'translate'
export const category = 'tools'
export const aliases = ['tr']
export const description = 'Translate text: .translate fr Hello'

export async function run({ m, args, reply, prefix }) {
  const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage
  const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text || ''
  const lang = (args[0] || '').toLowerCase()
  const text = args.slice(1).join(' ') || quotedText

  if (!lang || !text) {
    return reply(box('TRANSLATE', [
      `Use: ${prefix}translate fr Hello there`,
      `Or reply to a message with: ${prefix}translate fr`
    ]))
  }

  let out = ''
  try {
    out = (await gtranslate(text, { to: lang })).text
  } catch {
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=Autodetect|${lang}`
      out = (await (await fetch(url)).json())?.responseData?.translatedText || ''
    } catch {}
  }

  if (!out) return reply(box('TRANSLATE', ['Could not translate. Check the language code (fr, es, sw, de).']))
  return reply(box('TRANSLATE', [['language', lang], ['text', out]]))
}
