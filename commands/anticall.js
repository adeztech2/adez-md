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
      const mode = getSetting('anticall') || 'off' // 'off' | 'on' | 'block'

      for (const c of calls || []) {
        // Always log, so you can see in Render that calls reach the bot
        console.log(`📞 [${who}] call event: status=${c.status} from=${toNumber(c.from)} group=${!!c.isGroup} anticall=${mode}`)

        if (mode === 'off') continue
        if (c.status !== 'offer' || c.isGroup) continue

        const callFrom = c.from || c.chatId
        try {
          try {
            await sock.rejectCall(c.id, callFrom)
          } catch (e) {
            // Some calls arrive with a different id form, try the chat id
            if (c.chatId && c.chatId !== callFrom) await sock.rejectCall(c.id, c.chatId)
            else throw e
          }
          console.log(`📵 [${who}] Rejected call from ${toNumber(callFrom)}`)

          try {
            await sock.sendMessage(callFrom, {
              text: '📵 Calls are not allowed. Please send a message instead.'
            })
          } catch (e) {
            console.log(`⚠️ [${who}] could not message the caller: ${e.message}`)
          }

          if (mode === 'block') {
            try {
              await sock.updateBlockStatus(callFrom, 'block')
              console.log(`🚫 [${who}] Blocked ${toNumber(callFrom)}`)
            } catch (e) {
              console.log(`⚠️ [${who}] could not block: ${e.message}`)
            }
          }
        } catch (e) {
          console.log(`⚠️ [${who}] anticall failed: ${e.message}`)
        }
      }
    })
  })
}
