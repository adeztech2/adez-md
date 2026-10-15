import { box, botName } from './style.js'
import { getSetting, runAs } from './settings.js'

const idOf = (p) => (typeof p === 'string' ? p : p?.phoneNumber || p?.id || '')
const tag = (jid) => `@${String(jid).split('@')[0].split(':')[0]}`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function registerEvents(sock) {
  // Which linked number this socket belongs to (so each number uses its own settings)
  const selfNumber = () => String(sock.user?.id || '').split('@')[0].split(':')[0]

  // ----- Group joins, leaves, promotions -----
  sock.ev.on('group-participants.update', async (update) => {
    try {
      const { id, participants = [], action } = update
      const meta = await sock.groupMetadata(id).catch(() => null)
      const group = meta?.subject || 'this group'
      const jids = participants.map(idOf).filter(Boolean)
      if (!jids.length) return

      let text = ''
      if (action === 'add') {
        text = box(`${botName()} WELCOME`, [
          ['member', jids.map(tag).join(', ')],
          ['group', group],
          'Please read the group rules 👋'
        ])
      } else if (action === 'remove') {
        text = box(`${botName()} GOODBYE`, [
          ['member', jids.map(tag).join(', ')],
          ['group', group],
          'Left the group 👋'
        ])
      } else if (action === 'promote') {
        text = box('NEW ADMIN', [['member', jids.map(tag).join(', ')], 'Promoted to admin 👑'])
      } else if (action === 'demote') {
        text = box('ADMIN REMOVED', [['member', jids.map(tag).join(', ')], 'Is no longer an admin'])
      } else {
        return
      }

      await sock.sendMessage(id, { text, mentions: jids })
    } catch (e) {
      console.log('Group event error:', e.message)
    }
  })

  // ----- Status updates (only when .autoview is on for this linked number) -----
  sock.ev.on('messages.upsert', ({ messages }) =>
    runAs(selfNumber(), async () => {
      if (getSetting('autoview') !== 'on') return
      for (const m of messages || []) {
        if (m.key?.remoteJid !== 'status@broadcast' || m.key.fromMe) continue
        try {
          await sleep(1000 + Math.floor(Math.random() * 2000)) // look natural, not instant
          await sock.readMessages([m.key])
        } catch (e) {
          console.log('Auto status view failed:', e.message)
        }
      }
    })
  )

  // ----- Incoming calls (only when .anticall is on for this linked number) -----
  sock.ev.on('call', (calls) =>
    runAs(selfNumber(), async () => {
      if (getSetting('anticall') !== 'on') return
      for (const call of calls || []) {
        if (call.status !== 'offer') continue
        try {
          await sock.rejectCall(call.id, call.from)
          await sock.sendMessage(call.from, {
            text: box(`${botName()} ANTICALL`, ['Calls are not allowed. Please send a message instead.'])
          })
        } catch (e) {
          console.log('Anticall failed:', e.message)
        }
      }
    })
  )

  console.log('📣 Group events registered')
}
