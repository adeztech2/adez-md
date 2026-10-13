import axios from 'axios'

export const name = 'ai'
export const category = 'ai'
export const aliases = ['ask', 'gpt']
export const description = 'Ask the AI a question'

export async function run(ctx) {
  const { args, prefix, reply } = ctx
  const question = args.join(' ').trim()

  if (!question) return reply(`Usage: ${prefix}ai <your question>`)

  try {
    const res = await axios.get(
      `https://text.pollinations.ai/${encodeURIComponent(question)}`,
      { timeout: 60000, responseType: 'text' }
    )
    const answer = String(res.data || '').trim()
    if (!answer) return reply('The AI gave no answer. Please try again.')

    await reply(answer)
  } catch (e) {
    console.log('Error in ai command:', e.message)
    await reply('The AI is busy right now. Please try again later.')
  }
}
