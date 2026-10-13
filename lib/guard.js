import { box } from './style.js'

// Returns a boxed error message if the command may not run, otherwise null
export function groupGuard(title, ctx, needBotAdmin = true) {
  if (!ctx.isGroup) return box(title, ['This works in groups only.'])
  if (!ctx.isAdmin && !ctx.isOwner) return box(title, ['⛔ Admins only.'])
  if (needBotAdmin && !ctx.isBotAdmin) return box(title, ['Make the bot an admin first.'])
  return null
}
