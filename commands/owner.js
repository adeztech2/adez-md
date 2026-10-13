import { box, botName } from '../lib/style.js'

export const name = 'owner'
export const category = 'general'
export const aliases = ['creator', 'dev']
export const description = 'Show the owner contact'

export async function run({ sock, from, m, reply }) {
  const number = '254111783552'

  await reply(box(`${botName()} OWNER`, [
    ['name', 'Arnold Adez'],
    ['number', `+${number}`],
    ['chat', `wa.me/${number}`]
  ]))

  const vcard =
    'BEGIN:VCARD\n' +
    'VERSION:3.0\n' +
    'FN:Arnold Adez\n' +
    `ORG:${botName()} Owner;\n` +
    `TEL;type=CELL;type=VOICE;waid=${number}:+${number}\n` +
    'END:VCARD'

  await sock.sendMessage(
    from,
    { contacts: { displayName: 'Arnold Adez', contacts: [{ vcard }] } },
    { quoted: m }
  )
}
