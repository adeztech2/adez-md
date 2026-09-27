const { logMessage, supabase } = require("./supabase");
const yts = require("yt-search");
const sharp = require("sharp");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

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

// Returns the quoted message (the one being replied to), or null
function getQuoted(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  if (!ctx?.quotedMessage) return null;
  return {
    key: {
      remoteJid: msg.key.remoteJid,
      id: ctx.stanzaId,
      participant: ctx.participant,
    },
    message: ctx.quotedMessage,
  };
}

function isGroup(jid) {
  return jid.endsWith("@g.us");
}

function numberToJid(number) {
  return number.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
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
        `│ ${PREFIX}play <query>\n` +
        `╰────────────────\n\n` +
        `╭───「 MEDIA 」\n` +
        `│ ${PREFIX}sticker (reply to image)\n` +
        `│ ${PREFIX}toimg (reply to sticker)\n` +
        `╰────────────────\n\n` +
        `╭───「 AI 」\n` +
        `│ ${PREFIX}ai <prompt>\n` +
        `╰────────────────\n\n` +
        `╭───「 GROUP 」\n` +
        `│ ${PREFIX}groupinfo\n` +
        `│ ${PREFIX}tagall\n` +
        `│ ${PREFIX}link\n` +
        `│ ${PREFIX}add <number>\n` +
        `│ ${PREFIX}kick <number>\n` +
        `│ ${PREFIX}promote <number>\n` +
        `│ ${PREFIX}demote <number>\n` +
        `╰────────────────\n\n` +
        `╭───「 OWNER 」\n` +
        `│ ${PREFIX}owner\n` +
        `│ ${PREFIX}broadcast <message>\n` +
        `│ ${PREFIX}restart\n` +
        `╰────────────────\n\n` +
        `> Built with Baileys 🖤`;

      try {
        await sock.sendMessage(
          from,
          { image: { url: "https://github.com/adeztech2.png" }, caption: menuText },
          { quoted: msg }
        );
      } catch (err) {
        await reply(menuText);
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

    // ---- MEDIA ----

    case "sticker":
    case "s": {
      const quoted = getQuoted(msg);
      const target = quoted || msg;
      const hasImage = target.message?.imageMessage;

      if (!hasImage) {
        await reply(`Reply to an image with ${PREFIX}sticker`);
        return;
      }

      try {
        const buffer = await downloadMediaMessage(target, "buffer", {});
        const webp = await sharp(buffer)
          .resize(512, 512, { fit: "cover" })
          .webp()
          .toBuffer();

        await sock.sendMessage(from, { sticker: webp }, { quoted: msg });
      } catch (err) {
        console.error("Sticker error:", err);
        await reply("Couldn't create sticker. Make sure you replied to an image.");
      }
      break;
    }

    case "toimg": {
      const quoted = getQuoted(msg);
      const target = quoted || msg;
      const hasSticker = target.message?.stickerMessage;

      if (!hasSticker) {
        await reply(`Reply to a sticker with ${PREFIX}toimg`);
        return;
      }

      try {
        const buffer = await downloadMediaMessage(target, "buffer", {});
        const png = await sharp(buffer).png().toBuffer();
        await sock.sendMessage(from, { image: png }, { quoted: msg });
      } catch (err) {
        console.error("Toimg error:", err);
        await reply("Couldn't convert sticker to image.");
      }
      break;
    }

    case "play":
    case "yt": {
      const query = args.join(" ").trim();
      if (!query) {
        await reply(`Usage: ${PREFIX}play <song or video name>`);
        return;
      }

      await reply(`Searching for "${query}"...`);

      try {
        const { videos } = await yts(query);
        if (!videos || videos.length === 0) {
          await reply("No results found.");
          return;
        }

        const top = videos[0];
        const caption =
          `*${top.title}*\n\n` +
          `Channel: ${top.author.name}\n` +
          `Duration: ${top.timestamp}\n` +
          `Views: ${top.views.toLocaleString()}\n\n` +
          `${top.url}`;

        await sock.sendMessage(
          from,
          { image: { url: top.thumbnail }, caption },
          { quoted: msg }
        );
      } catch (err) {
        console.error("Play command error:", err);
        await reply("Something went wrong searching YouTube. Try again.");
      }
      break;
    }

    // ---- AI ----

    case "ai":
    case "gpt": {
      const prompt = args.join(" ").trim();
      if (!prompt) {
        await reply(`Usage: ${PREFIX}ai <your question>`);
        return;
      }
      if (!ANTHROPIC_API_KEY) {
        await reply("AI isn't set up yet. Add ANTHROPIC_API_KEY in Render's Environment tab.");
        return;
      }

      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 500,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        const data = await res.json();
        const answer = data?.content?.[0]?.text || "No response from AI.";
        await reply(answer);
      } catch (err) {
        console.error("AI command error:", err);
        await reply("AI request failed. Try again.");
      }
      break;
    }

    // ---- GROUP ----

    case "groupinfo": {
      if (!isGroup(from)) {
        await reply("This command only works in groups.");
        return;
      }
      try {
        const meta = await sock.groupMetadata(from);
        await reply(
          `*${meta.subject}*\n\n` +
            `${meta.desc || "No description"}\n\n` +
            `Members: ${meta.participants.length}`
        );
      } catch (err) {
        await reply("Couldn't fetch group info.");
      }
      break;
    }

    case "tagall": {
      if (!isGroup(from)) {
        await reply("This command only works in groups.");
        return;
      }
      try {
        const meta = await sock.groupMetadata(from);
        const mentions = meta.participants.map((p) => p.id);
        const text = mentions.map((jid) => `@${jid.split("@")[0]}`).join(" ");
        await sock.sendMessage(from, { text, mentions }, { quoted: msg });
      } catch (err) {
        await reply("Couldn't tag everyone.");
      }
      break;
    }

    case "link": {
      if (!isGroup(from)) {
        await reply("This command only works in groups.");
        return;
      }
      try {
        const code = await sock.groupInviteCode(from);
        await reply(`https://chat.whatsapp.com/${code}`);
      } catch (err) {
        await reply("Couldn't get invite link. Make sure the bot is an admin.");
      }
      break;
    }

    case "add":
    case "kick":
    case "promote":
    case "demote": {
      if (!isGroup(from)) {
        await reply("This command only works in groups.");
        return;
      }
      if (!isOwner) {
        await reply("This command is for the bot owner only.");
        return;
      }

      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
      const targetJid = mentioned?.[0] || (args[0] ? numberToJid(args[0]) : null);

      if (!targetJid) {
        await reply(`Usage: ${PREFIX}${command} <number> (or reply/mention a member)`);
        return;
      }

      const actionMap = { add: "add", kick: "remove", promote: "promote", demote: "demote" };

      try {
        await sock.groupParticipantsUpdate(from, [targetJid], actionMap[command]);
        await reply(`Done: ${command} applied.`);
      } catch (err) {
        console.error("Group action error:", err);
        await reply("Couldn't complete that action. Make sure the bot is an admin.");
      }
      break;
    }

    // ---- OWNER ----

    case "owner": {
      if (!isOwner) {
        await reply("This command is for the bot owner only.");
        return;
      }
      await reply("Hey boss, ADEZ MD is running fine ✅");
      break;
    }

    case "broadcast": {
      if (!isOwner) {
        await reply("This command is for the bot owner only.");
        return;
      }
      const message = args.join(" ").trim();
      if (!message) {
        await reply(`Usage: ${PREFIX}broadcast <message>`);
        return;
      }

      try {
        const { data: users, error } = await supabase.from("users").select("jid");
        if (error) throw error;

        let sent = 0;
        for (const u of users) {
          try {
            await sock.sendMessage(u.jid, { text: `📢 ${message}` });
            sent++;
          } catch (_) {
            // skip failures for individual recipients
          }
        }
        await reply(`Broadcast sent to ${sent}/${users.length} users.`);
      } catch (err) {
        console.error("Broadcast error:", err);
        await reply("Broadcast failed.");
      }
      break;
    }

    case "restart": {
      if (!isOwner) {
        await reply("This command is for the bot owner only.");
        return;
      }
      await reply("Restarting...");
      setTimeout(() => process.exit(0), 1000); // Render will auto-restart the process
      break;
    }

    default: {
      await reply(`Unknown command: *${command}*\nType *${PREFIX}menu* to see available commands.`);
    }
  }
}

module.exports = { handleMessage };
