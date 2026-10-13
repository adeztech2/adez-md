import { box, botName } from './style.js'

const idOf = (p) => (typeof p === 'string' ? p : p?.phoneNumber || p?.id || '')
const tag = (jid) => `@${String(jid).split('@')[0].split(':')[0]}`

export function registerEvents(sock) {
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

  console.log('📣 Group events registered')
          }
