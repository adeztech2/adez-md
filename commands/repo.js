export const name = 'repo'
export const category = 'general'
export const aliases = ['script', 'source']
export const description = 'Show the bot repository link'

const REPO_URL = 'https://github.com/adeztech2/adez-md'

export async function run(ctx) {
  await ctx.reply(
    `*ADEZ MD*\n\n` +
    `Source code:\n${REPO_URL}\n\n` +
    `Owner: wa.me/254111783552`
  )
}
