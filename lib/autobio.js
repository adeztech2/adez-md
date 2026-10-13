import { getSetting } from './settings.js'

let timer = null

function buildText() {
  const s = Math.floor(process.uptime())
  const up = `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  const time = new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Africa/Nairobi',
    hour: '2-digit',
    minute: '2-digit'
  })
  return `${getSetting('botname')} | Online ⚡ | ${time} | Uptime ${up}`
}

export async function updateBioNow(sock) {
  await sock.updateProfileStatus(buildText())
}

export function startAutoBio(sock) {
  if (timer) clearInterval(timer)
  timer = setInterval(async () => {
    if (getSetting('autobio') !== 'on') return
    try {
      await updateBioNow(sock)
    } catch (e) {
      console.log('Auto bio failed:', e.message)
    }
  }, 5 * 60 * 1000)
}
