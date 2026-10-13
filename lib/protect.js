// ============================================================
//  lib/protect.js  - anti-call guard (listens to WhatsApp call events)
//  Called once per connection from index.js.
// ============================================================
import { getSetting, runAs } from './settings.js'

const toNumber = (jid = '') => String(jid).split('@')[0].split(':')[0]

export function registerCallGuard(sock) {
  sock.ev.on('call', async (calls) => {
    const who = toNumber(sock.user?.id)
    await runAs(who, async () => {
      const mode = getSetting('anticall') // 'off' | 'on' | 'block'
      if (!mode || mode === 'off') return

      for (const c of calls || []) {
        if (c.status !== 'offer' || c.isGroup) continue
        try {
          await sock.rejectCall(c.id, c.from)
          await sock.sendMessage(c.from, {
            text: '📵 Calls are not allowed. Please send a message instead.'
          })
          if (mode === 'block') await sock.updateBlockStatus(c.from, 'block')
          console.log(`📵 [${who}] Rejected a call from ${toNumber(c.from)}${mode === 'block' ? ' and blocked' : ''}`)
        } catch (e) {
          console.log(`⚠️ [${who}] anticall failed: ${e.message}`)
        }
      }
    })
  })
}
