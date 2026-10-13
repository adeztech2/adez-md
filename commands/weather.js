import axios from 'axios'
import { box } from '../lib/style.js'

export const name = 'weather'
export const category = 'tools'
export const description = 'Weather for a city'

export async function run({ args, prefix, reply }) {
  const city = args.join(' ').trim()
  if (!city) return reply(box('WEATHER', [['usage', `${prefix}weather <city>`]]))

  try {
    const { data } = await axios.get(
      `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
      { timeout: 20000 }
    )
    const c = data.current_condition[0]
    const place = data.nearest_area?.[0]
    await reply(box('WEATHER', [
      ['city', `${place?.areaName?.[0]?.value || city}, ${place?.country?.[0]?.value || ''}`],
      ['sky', c.weatherDesc[0].value],
      ['temp', `${c.temp_C}°C (feels ${c.FeelsLikeC}°C)`],
      ['humidity', `${c.humidity}%`],
      ['wind', `${c.windspeedKmph} km/h`]
    ]))
  } catch (e) {
    console.log('Weather failed:', e.message)
    await reply(box('WEATHER', ['City not found or service busy.']))
  }
}
