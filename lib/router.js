// Extracts plain text from any type of WhatsApp message
function getMessageText(msg) {
  const m = msg.message;
  return (
    m?.conversation ||
    m?.extendedTextMessage?.text ||
    m?.imageMessage?.caption ||
    m?.videoMessage?.caption ||
    ""
  );
}

async function handleMessage(sock, msg, { PREFIX, OWNER_NUMBER, BOT_NAME }) {
  const from = msg.key.remoteJid;
  const text = getMessageText(msg).trim();

  if (!text.startsWith(PREFIX)) return; // ignore non-command messages

  const args = text.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  const sender = msg.key.participant || msg.key.remoteJid || "";
  const isOwner = sender.includes(OWNER_NUMBER);

  const reply = (content) => sock.sendMessage(from, { text: content }, { quoted: msg });

  switch (command) {
    case "ping": {
      const start = Date.now();
      await reply("Pinging...");
      const latency = Date.now() - start;
      await reply(`Pong! 🏓 ${latency}ms`);
      break;
    }

    case "menu":
    case "help": {
      await reply(
        `*${BOT_NAME}*\n\n` +
          `Prefix: ${PREFIX}\n\n` +
          `*${PREFIX}ping* - check if bot is alive\n` +
          `*${PREFIX}menu* - show this menu\n` +
          `*${PREFIX}alive* - alive check\n` +
          `*${PREFIX}runtime* - how long the bot has been running\n` +
          `*${PREFIX}jid* - get this chat's ID\n` +
          `*${PREFIX}repo* - link to source code\n` +
          `*${PREFIX}owner* - owner-only test command`
      );
      break;
    }

    case "alive": {
      await reply(`${BOT_NAME} is alive and running ✅\nPrefix: ${PREFIX}`);
      break;
    }

    case "runtime":
    case "uptime": {
      const seconds = Math.floor(process.uptime());
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      await reply(`Uptime: ${h}h ${m}m ${s}s`);
      break;
    }

    case "jid": {
      await reply(`This chat's JID:\n${from}`);
      break;
    }

    case "repo":
    case "source": {
      await reply(`${BOT_NAME} source code:\nhttps://github.com/adeztech2/adez-md`);
      break;
    }

    case "owner": {
      if (!isOwner) {
        await reply("This command is for the bot owner only.");
        return;
      }
      await reply("Hey boss, ADEZ MD is running fine ✅");
      break;
    }

    default: {
      await reply(`Unknown command: *${command}*\nType *${PREFIX}menu* to see available commands.`);
    }
  }
}

module.exports = { handleMessage };
