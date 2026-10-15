import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { box, noForward } from '../lib/style.js'

const execFileAsync = promisify(execFile)

export const name = 'play'
export const category = 'download'
export const description = 'Search YouTube and send the audio (play <song name or link>)'

const YTDLP = process.env.YTDLP_PATH || 'yt-dlp'
const MAX_SECONDS = 10 * 60   // skip anything longer than 10 minutes
const MAX_BYTES = '16M'       // WhatsApp audio limit is roughly this size

const isUrl = (s) => /^https?:\/\//i.test(s) || /youtu\.?be/i.test(s)

async function ytdlp(args, timeout = 180000) {
  return execFileAsync(YTDLP, args, { timeout, maxBuffer: 10 * 1024 * 1024 })
}

export async function run({ sock, from, m, args, reply, prefix }) {
  const query = (args || []).join(' ').trim()
  if (!query) {
    return reply(`Usage: ${prefix}play <song name or YouTube link>`)
  }

  const target = isUrl(query) ? query : `ytsearch1:${query}`
  let dir = null

  try {
    // 1. Get video info without downloading
    const { stdout } = await ytdlp(['--no-playlist', '--no-warnings', '--dump-json', target], 60000)
    const info = JSON.parse(stdout.trim().split('\n')[0])

    if (info.duration && info.duration > MAX_SECONDS) {
      return reply(`❌ That track is longer than ${MAX_SECONDS / 60} minutes.`)
    }

    const mins = info.duration ? `${Math.floor(info.duration / 60)}:${String(info.duration % 60).padStart(2, '0')}` : 'unknown'
    await reply(box('PLAYING', [
      ['title', info.title],
      ['channel', info.uploader || 'unknown'],
      ['duration', mins]
    ]))

    // 2. Download the audio into a temp folder
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'play-'))
    await ytdlp([
      '--no-playlist', '--no-warnings',
      '-f', 'bestaudio[ext=m4a]/bestaudio',
      '--max-filesize', MAX_BYTES,
      '-o', path.join(dir, '%(id)s.%(ext)s'),
      info.webpage_url || target
    ])

    const file = fs.readdirSync(dir)[0]
    if (!file) throw new Error('download produced no file')
    const buffer = fs.readFileSync(path.join(dir, file))

    // 3. Send as audio
    await sock.sendMessage(from, noForward({
      audio: buffer,
      mimetype: 'audio/mp4',
      fileName: `${info.title}.m4a`
    }), { quoted: m })
  } catch (e) {
    console.log('Play failed:', e.message)
    await reply(`❌ Could not play that. ${e.message.includes('max-filesize') || e.message.includes('larger') ? 'The file is too large.' : 'Try another search or link.'}`)
  } finally {
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  }
}
