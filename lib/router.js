const { logMessage } = require("./supabase");

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

  // Store the user and message in Supabase (doesn't block replies if it fails)
  logMessage({ jid: from, sender, body: text, command });

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
      const seconds = Math.floor(process.uptime());
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);

      const menuText =
        `╭───「 *${BOT_NAME}* 」\n` +
        `│ Prefix : ${PREFIX}\n` +
        `│ Uptime : ${h}h ${m}m\n` +
        `╰────────────────\n\n` +
        `╭───「 GENERAL 」\n` +
        `│ ${PREFIX}ping\n` +
        `│ ${PREFIX}menu\n` +
        `│ ${PREFIX}alive\n` +
        `│ ${PREFIX}runtime\n` +
        `│ ${PREFIX}jid\n` +
        `│ ${PREFIX}repo\n` +
        `╰────────────────\n\n` +
        `╭───「 OWNER 」\n` +
        `│ ${PREFIX}owner\n` +
        `╰────────────────\n\n` +
        `> Built with Baileys 🖤`;

      try {
        await sock.sendMessage(
          from,
          {
            image: { url: "https://github.com/adeztech2.png" },
            caption: menuText,
          },
          { quoted: msg }
        );
      } catch (err) {
        await reply(menuText); // fallback if the image can't load
      }
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
