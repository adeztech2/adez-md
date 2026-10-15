import { box } from '../lib/style.js'

const ZONES = {
  nairobi: 'Africa/Nairobi', lagos: 'Africa/Lagos', cairo: 'Africa/Cairo',
  johannesburg: 'Africa/Johannesburg', london: 'Europe/London', paris: 'Europe/Paris',
  dubai: 'Asia/Dubai', delhi: 'Asia/Kolkata', tokyo: 'Asia/Tokyo', sydney: 'Australia/Sydney',
  newyork: 'America/New_York', losangeles: 'America/Los_Angeles'
}

export const name = 'time'
export const category = 'tools'
export const description = 'Time in a city: .time london'

export async function run({ args, reply, prefix }) {
  const input = (args[0] || 'nairobi').toLowerCase().replace(/[^a-z/_]/g, '')
  const zone = ZONES[input] || (args[0] || '')
  try {
    const now = new Date()
    const fmt = (opts) => new Intl.DateTimeFormat('en-GB', { timeZone: zone, ...opts }).format(now)
    return reply(box('TIME', [
      ['zone', zone],
      ['date', fmt({ dateStyle: 'full' })],
      ['time', fmt({ timeStyle: 'medium' })]
    ]))
  } catch {
    return reply(box('TIME', [
      `Unknown place. Try: ${Object.keys(ZONES).join(', ')}`,
      `Or a zone name like ${prefix}time Africa/Nairobi`
    ]))
  }
}
