import { run as menuRun } from '../commands/menu.js'

export const name = 'menureply'

const num = (jid = '') => String(jid).split('@')[0].split(':')[0]

// When someone replies to the menu message with a number (like 2), open that category
export async function run(ctx) {
  const { sock, m, text } = ctx
  if (!/^\d{1,2}$/.test(String(text || '').trim())) return

  let msg = m.message
  msg = msg?.ephemeralMessage?.message || msg
  const info = msg?.extendedTextMessage?.contextInfo
  const quoted = info?.quotedMessage
  if (!quoted) return

  const quotedText =
    quoted.conversation ||
    quoted.extendedTextMessage?.text ||
    quoted.imageMessage?.caption ||
    quoted.videoMessage?.caption ||
    ''
  if (!/Reply to this message with a number/i.test(quotedText)) return

  // Only answer if the menu was sent by this bot (stops two linked bots in one group both answering)
  const who = info.participant
  if (who) {
    const mine = [num(sock.user?.id), num(sock.user?.lid)].filter(Boolean)
    const isLid = String(who).endsWith('@lid')
    if (!mine.includes(num(who)) && !(isLid && !sock.user?.lid)) return
  }

  await menuRun({ ...ctx, args: [String(text).trim()] })
}
