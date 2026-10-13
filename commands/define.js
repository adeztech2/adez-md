import axios from 'axios'
import { box } from '../lib/style.js'

export const name = 'define'
export const category = 'tools'
export const aliases = ['dictionary', 'meaning']
export const description = 'Meaning of an English word'

export async function run({ args, prefix, reply }) {
  const word = args[0]?.trim()
  if (!word) return reply(box('DEFINE', [['usage', `${prefix}define <word>`]]))

  try {
    const { data } = await axios.get(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { timeout: 15000 }
    )
    const meaning = data[0].meanings[0]
    const def = meaning.definitions[0]
    const rows = [
      ['word', data[0].word],
      ['type', meaning.partOfSpeech],
      ['meaning', def.definition]
    ]
    if (def.example) rows.push(['example', def.example])
    await reply(box('DEFINE', rows))
  } catch (e) {
    await reply(box('DEFINE', [`No meaning found for "${word}".`]))
  }
      }
