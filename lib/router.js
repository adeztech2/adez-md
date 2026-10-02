const { logMessage, supabase } = require("./supabase");
const yts = require("yt-search");
const sharp = require("sharp");
const { evaluate } = require("mathjs");
const crypto = require("crypto");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OWNER_NAME = "Arnold Adez";
const POWERED_BY = "ADEZ TECH";

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

function getQuoted(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  if (!ctx?.quotedMessage) return null;
  return {
    key: { remoteJid: msg.key.remoteJid, id: ctx.stanzaId, participant: ctx.participant },
    message: ctx.quotedMessage,
  };
}

function isGroup(jid) {
  return jid.endsWith("@g.us");
}

function numberToJid(number) {
  return number.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
}

// Simple in-memory store of the last riddle asked per chat, for .riddleanswer
const lastRiddle = {};

const RIDDLES = [
  { q: "The more you take, the more you leave behind. What am I?", a: "Footsteps" },
  { q: "I speak without a mouth and hear without ears. What am I?", a: "An echo" },
  { q: "What has keys but no locks, space but no room?", a: "A keyboard" },
  { q: "What gets wetter as it dries?", a: "A towel" },
];

const TRUTHS = [
  "What's the most embarrassing thing you've ever done?",
  "What's a secret you've never told anyone in this chat?",
  "What's your biggest fear?",
  "Who was your first crush?",
];

const DARES = [
  "Send a voice note singing your favorite song.",
  "Text your crush right now and tell them 'hi'.",
  "Change your profile picture to something silly for an hour.",
  "Reply to this using only emojis for the next 3 messages.",
];

const WYR = [
  "Would you rather be able to fly or be invisible?",
  "Would you rather always be 10 minutes late or 20 minutes early?",
  "Would you rather lose your phone or your wallet?",
  "Would you rather never use social media again or never watch TV again?",
];

const EIGHT_BALL = [
  "Yes, definitely.",
  "No way.",
  "Ask again later.",
  "It is certain.",
  "Very doubtful.",
  "Signs point to yes.",
  "Cannot predict now.",
];

// Reaction types available on the waifu.pics free public API (no key needed)
const REACTIONS = [
  "hug", "pat", "cuddle", "slap", "kiss", "poke", "wink", "wave",
  "dance", "highfive", "cry", "smile", "bonk", "yeet", "handhold",
  "nom", "bite", "blush", "glomp", "smug",
];

async function fetchReactionGif(type) {
  const res = await fetch(`https://api.waifu.pics/sfw/${type}`);
  const data = await res.json();
  return data.url;
}

async function handleMessage(sock, msg, { PREFIX, OWNER_NUMBER, BOT_NAME, botPhone }) {
  const from = msg.key.remoteJid;
  const text = getMessageText(msg).trim();

  console.log(`[MSG TEXT] "${text}" from=${from}`);

  if (!text.startsWith(PREFIX)) return;

  const args = text.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();
  const argText = args.join(" ").trim();

  const sender = msg.key.participant || msg.key.remoteJid || "";
  const isOwner = sender.includes(OWNER_NUMBER);

  console.log(`[CMD RECEIVED] command=".${command}" sender=${sender} chat=${from}`);

  logMessage({ jid: from, sender, body: text, command, botPhone });

  const reply = async (content) => {
    try {
      const result = await sock.sendMessage(from, { text: content }, { quoted: msg });
      console.log(`[REPLY SENT OK] to ${from}`);
      return result;
    } catch (err) {
      console.error(`[REPLY FAILED] to ${from}:`, err);
      throw err;
    }
  };

  // Handle simple reaction commands generically
  if (REACTIONS.includes(command)) {
    try {
      const url = await fetchReactionGif(command);
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
      const targetTag = mentioned?.[0] ? `@${mentioned[0].split("@")[0]}` : "";
      await sock.sendMessage(
        from,
        {
          video: { url },
          gifPlayback: true,
          caption: targetTag ? `${command} ${targetTag}` : `${command}!`,
          mentions: mentioned || [],
        },
        { quoted: msg }
      );
    } catch (err) {
      await reply("Couldn't fetch that reaction right now.");
    }
    return;
  }

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

      const box = (emoji, title, desc, items) => {
        const lines = items.map((i) => `│ ${i}`).join("\n");
        return (
          `╭──── ${emoji} ${title} ────╮\n` +
          `│ 📝 ${desc}\n` +
          `│ ──────────────────\n` +
          `${lines}\n` +
          `╰─────────────────────╯\n\n`
        );
      };

      let menuText =
        `╭──── 🤖 *${BOT_NAME}* ────╮\n` +
        `│ Owner  : ${OWNER_NAME}\n` +
        `│ Prefix : ${PREFIX}\n` +
        `│ Uptime : ${h}h ${m}m\n` +
        `╰─────────────────────╯\n\n`;

      menuText += box("🔧", "GENERAL", "General purpose commands", [
        `${PREFIX}ping`,
        `${PREFIX}menu`,
        `${PREFIX}alive`,
        `${PREFIX}runtime`,
        `${PREFIX}jid`,
        `${PREFIX}repo`,
      ]);

      menuText += box("📥", "MEDIA & SEARCH", "Media and lookup commands", [
        `${PREFIX}sticker`,
        `${PREFIX}toimg`,
        `${PREFIX}play`,
        `${PREFIX}wiki`,
        `${PREFIX}define`,
        `${PREFIX}qr`,
      ]);

      menuText += box("🤖", "AI", "Artificial intelligence commands", [
        `${PREFIX}ai`,
      ]);

      menuText += box("🛠️", "UTILITY", "Utility and tool commands", [
        `${PREFIX}calc`,
        `${PREFIX}password`,
        `${PREFIX}timestamp`,
        `${PREFIX}shorten`,
        `${PREFIX}base64encode`,
        `${PREFIX}base64decode`,
      ]);

      menuText += box("🎮", "FUN", "Entertainment and games", [
        `${PREFIX}joke`,
        `${PREFIX}fact`,
        `${PREFIX}quote`,
        `${PREFIX}coinflip`,
        `${PREFIX}dice`,
        `${PREFIX}8ball`,
        `${PREFIX}truth`,
        `${PREFIX}dare`,
        `${PREFIX}wyr`,
        `${PREFIX}riddle`,
        `${PREFIX}riddleanswer`,
        `${PREFIX}rate`,
        `${PREFIX}ship`,
      ]);

      menuText += box("💕", "REACTIONS", "Fun interaction commands", REACTIONS.map((r) => `${PREFIX}${r}`));

      menuText += box("👥", "GROUP", "Group management commands", [
        `${PREFIX}groupinfo`,
        `${PREFIX}tagall`,
        `${PREFIX}link`,
        `${PREFIX}add`,
        `${PREFIX}kick`,
        `${PREFIX}promote`,
        `${PREFIX}demote`,
      ]);

      menuText += box("👑", "OWNER", "Bot owner only commands", [
        `${PREFIX}owner`,
        `${PREFIX}broadcast`,
        `${PREFIX}restart`,
      ]);

      menuText += `> Powered by ${POWERED_BY} 🖤`;

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
      await reply(`${BOT_NAME} is alive and running ✅\nPowered by ${POWERED_BY}\nPrefix: ${PREFIX}`);
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
      if (!target.message?.imageMessage) {
        await reply(`Reply to an image with ${PREFIX}sticker`);
        return;
      }
      try {
        const buffer = await downloadMediaMessage(target, "buffer", {});
        const webp = await sharp(buffer).resize(512, 512, { fit: "cover" }).webp().toBuffer();
        await sock.sendMessage(from, { sticker: webp }, { quoted: msg });
      } catch (err) {
        await reply("Couldn't create sticker. Make sure you replied to an image.");
      }
      break;
    }

    case "toimg": {
      const quoted = getQuoted(msg);
      const target = quoted || msg;
      if (!target.message?.stickerMessage) {
        await reply(`Reply to a sticker with ${PREFIX}toimg`);
        return;
      }
      try {
        const buffer = await downloadMediaMessage(target, "buffer", {});
        const png = await sharp(buffer).png().toBuffer();
        await sock.sendMessage(from, { image: png }, { quoted: msg });
      } catch (err) {
        await reply("Couldn't convert sticker to image.");
      }
      break;
    }

    case "play":
    case "yt": {
      if (!argText) {
        await reply(`Usage: ${PREFIX}play <song or video name>`);
        return;
      }
      await reply(`Searching for "${argText}"...`);
      try {
        const { videos } = await yts(argText);
        if (!videos || videos.length === 0) {
          await reply("No results found.");
          return;
        }
        const top = videos[0];
        const caption =
          `*${top.title}*\n\nChannel: ${top.author.name}\nDuration: ${top.timestamp}\n` +
          `Views: ${top.views.toLocaleString()}\n\n${top.url}`;
        await sock.sendMessage(from, { image: { url: top.thumbnail }, caption }, { quoted: msg });
      } catch (err) {
        await reply("Something went wrong searching YouTube. Try again.");
      }
      break;
    }

    // ---- INFO / SEARCH ----

    case "wiki": {
      if (!argText) {
        await reply(`Usage: ${PREFIX}wiki <topic>`);
        return;
      }
      try {
        const res = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(argText)}`
        );
        const data = await res.json();
        if (!data.extract) {
          await reply("No Wikipedia article found for that.");
          return;
        }
        await reply(`*${data.title}*\n\n${data.extract}`);
      } catch (err) {
        await reply("Wikipedia lookup failed.");
      }
      break;
    }

    case "define": {
      if (!argText) {
        await reply(`Usage: ${PREFIX}define <word>`);
        return;
      }
      try {
        const res = await fetch(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(argText)}`
        );
        const data = await res.json();
        if (!Array.isArray(data)) {
          await reply("No definition found.");
          return;
        }
        const meaning = data[0]?.meanings?.[0];
        const def = meaning?.definitions?.[0]?.definition;
        await reply(`*${argText}* (${meaning?.partOfSpeech || "?"})\n\n${def || "No definition found."}`);
      } catch (err) {
        await reply("Dictionary lookup failed.");
      }
      break;
    }

    // ---- UTILITY ----

    case "calc": {
      if (!argText) {
        await reply(`Usage: ${PREFIX}calc <expression>, e.g. ${PREFIX}calc 12 * (3 + 4)`);
        return;
      }
      try {
        const result = evaluate(argText);
        await reply(`${argText} = ${result}`);
      } catch (err) {
        await reply("That expression couldn't be calculated. Check the syntax.");
      }
      break;
    }

    case "password": {
      const length = Math.min(Math.max(parseInt(args[0]) || 12, 6), 64);
      const password = crypto.randomBytes(length).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, length);
      await reply(`Generated password (${length} chars):\n${password}`);
      break;
    }

    case "timestamp": {
      const now = new Date();
      await reply(`Unix: ${Math.floor(now.getTime() / 1000)}\nISO: ${now.toISOString()}`);
      break;
    }

    case "qr": {
      if (!argText) {
        await reply(`Usage: ${PREFIX}qr <text or link>`);
        return;
      }
      try {
        const qrcode = require("qrcode");
        const buffer = await qrcode.toBuffer(argText, { width: 400 });
        await sock.sendMessage(from, { image: buffer, caption: `QR for: ${argText}` }, { quoted: msg });
      } catch (err) {
        await reply("Couldn't generate QR code.");
      }
      break;
    }

    case "shorten":
    case "tinyurl": {
      if (!argText) {
        await reply(`Usage: ${PREFIX}shorten <url>`);
        return;
      }
      try {
        const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(argText)}`);
        const short = await res.text();
        await reply(short);
      } catch (err) {
        await reply("Couldn't shorten that URL.");
      }
      break;
    }

    case "base64encode": {
      await reply(Buffer.from(argText, "utf-8").toString("base64"));
      break;
    }

    case "base64decode": {
      try {
        await reply(Buffer.from(argText, "base64").toString("utf-8"));
      } catch (err) {
        await reply("Invalid base64 input.");
      }
      break;
    }

    // ---- FUN ----

    case "joke": {
      try {
        const res = await fetch("https://official-joke-api.appspot.com/random_joke");
        const data = await res.json();
        await reply(`${data.setup}\n\n${data.punchline}`);
      } catch (err) {
        await reply("Couldn't fetch a joke right now.");
      }
      break;
    }

    case "fact": {
      try {
        const res = await fetch("https://uselessfacts.jsph.pl/api/v2/facts/random?language=en");
        const data = await res.json();
        await reply(data.text);
      } catch (err) {
        await reply("Couldn't fetch a fact right now.");
      }
      break;
    }

    case "quote": {
      try {
        const res = await fetch("https://api.quotable.io/random");
        const data = await res.json();
        await reply(`"${data.content}"\n— ${data.author}`);
      } catch (err) {
        await reply("Couldn't fetch a quote right now.");
      }
      break;
    }

    case "coinflip": {
      await reply(Math.random() < 0.5 ? "Heads" : "Tails");
      break;
    }

    case "dice": {
      await reply(`🎲 ${Math.floor(Math.random() * 6) + 1}`);
      break;
    }

    case "8ball": {
      if (!argText) {
        await reply(`Usage: ${PREFIX}8ball <question>`);
        return;
      }
      await reply(EIGHT_BALL[Math.floor(Math.random() * EIGHT_BALL.length)]);
      break;
    }

    case "truth": {
      await reply(TRUTHS[Math.floor(Math.random() * TRUTHS.length)]);
      break;
    }

    case "dare": {
      await reply(DARES[Math.floor(Math.random() * DARES.length)]);
      break;
    }

    case "wyr": {
      await reply(WYR[Math.floor(Math.random() * WYR.length)]);
      break;
    }

    case "riddle": {
      const r = RIDDLES[Math.floor(Math.random() * RIDDLES.length)];
      lastRiddle[from] = r.a;
      await reply(`🧩 ${r.q}\n\nUse ${PREFIX}riddleanswer to reveal the answer.`);
      break;
    }

    case "riddleanswer": {
      const answer = lastRiddle[from];
      await reply(answer ? `Answer: ${answer}` : "No riddle asked yet. Try .riddle first.");
      break;
    }

    case "rate": {
      if (!argText) {
        await reply(`Usage: ${PREFIX}rate <anything>`);
        return;
      }
      const score = Math.floor(Math.random() * 101);
      await reply(`I'd rate "${argText}" a solid ${score}/100.`);
      break;
    }

    case "ship": {
      if (args.length < 2) {
        await reply(`Usage: ${PREFIX}ship <name1> <name2>`);
        return;
      }
      const combined = args.join("");
      const hash = crypto.createHash("md5").update(combined).digest("hex");
      const percent = parseInt(hash.slice(0, 2), 16) % 101;
      await reply(`💘 ${args[0]} + ${args[1]} = ${percent}% compatible`);
      break;
    }

    // ---- AI ----

    case "ai":
    case "gpt": {
      if (!argText) {
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
            messages: [{ role: "user", content: argText }],
          }),
        });
        const data = await res.json();
        await reply(data?.content?.[0]?.text || "No response from AI.");
      } catch (err) {
        await reply("AI request failed. Try again.");
      }
      break;
    }

    // ---- GROUP ----

    case "groupinfo": {
      if (!isGroup(from)) { await reply("This command only works in groups."); return; }
      try {
        const meta = await sock.groupMetadata(from);
        await reply(`*${meta.subject}*\n\n${meta.desc || "No description"}\n\nMembers: ${meta.participants.length}`);
      } catch (err) {
        await reply("Couldn't fetch group info.");
      }
      break;
    }

    case "tagall": {
      if (!isGroup(from)) { await reply("This command only works in groups."); return; }
      try {
        const meta = await sock.groupMetadata(from);
        const mentions = meta.participants.map((p) => p.id);
        const textOut = mentions.map((jid) => `@${jid.split("@")[0]}`).join(" ");
        await sock.sendMessage(from, { text: textOut, mentions }, { quoted: msg });
      } catch (err) {
        await reply("Couldn't tag everyone.");
      }
      break;
    }

    case "link": {
      if (!isGroup(from)) { await reply("This command only works in groups."); return; }
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
      if (!isGroup(from)) { await reply("This command only works in groups."); return; }
      if (!isOwner) { await reply("This command is for the bot owner only."); return; }

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
        await reply("Couldn't complete that action. Make sure the bot is an admin.");
      }
      break;
    }

    // ---- OWNER ----

    case "owner": {
      if (!isOwner) { await reply("This command is for the bot owner only."); return; }
      await reply(`Hey ${OWNER_NAME}, ${BOT_NAME} is running fine ✅\nPowered by ${POWERED_BY}`);
      break;
    }

    case "broadcast": {
      if (!isOwner) { await reply("This command is for the bot owner only."); return; }
      if (
