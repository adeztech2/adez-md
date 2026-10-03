const {
  default: makeWASocket,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const pino = require("pino");
const qrcode = require("qrcode");
const express = require("express");
const path = require("path");

const { handleMessage } = require("./lib/router");
const { useSupabaseAuthState } = require("./lib/authState");
const { upsertSession, getResumableSessions, removeSession } = require("./lib/supabase");

const BOT_NAME = "ADEZ MD";
const PREFIX = ".";
const MODE = "public"; // "public" = anyone can use commands, "private" = owner only
const TOTAL_COMMANDS = 61; // update this if you add/remove commands in lib/router.js
const DEVELOPER = "Arnold Adez";
const PORT = process.env.PORT || 3000;

// One entry per linked phone number: { sock, qr, status, hasAlertedOwner }
const sessions = new Map();

function normalizeNumber(raw) {
  return (raw || "").replace(/[^0-9]/g, "");
}

// --- Web server: pairing page where anyone can link their own number ---
const app = express();
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "pair.html"));
});

app.get("/qr", async (req, res) => {
  const phone = normalizeNumber(req.query.phone);
  const session = sessions.get(phone);

  if (!session || !session.qr) {
    res.status(404).send("No QR available yet. Request a code/QR first, or it may already be connected.");
    return;
  }
  try {
    const buffer = await qrcode.toBuffer(session.qr, { width: 280 });
    res.type("png").send(buffer);
  } catch (err) {
    res.status(500).send("Failed to generate QR");
  }
});

// Reports how a session is doing, so the pairing page knows when to stop polling.
app.get("/status", (req, res) => {
  const phone = normalizeNumber(req.query.phone);
  const session = sessions.get(phone);
  res.json({ status: session?.status || "not_started" });
});

// Request a pairing code for a given phone number (digits only, country code first, no +).
// Starts a brand-new session for that number if one isn't already running.
app.get("/request-code", async (req, res) => {
  const phone = normalizeNumber(req.query.number);

  if (!phone) {
    res.status(400).json({ error: "Provide a phone number, e.g. ?number=254111783552" });
    return;
  }

  try {
    const session = await startSession(phone);

    if (session.sock.authState?.creds?.registered) {
      res.status(400).json({ error: "This number is already connected. No pairing needed." });
      return;
    }

    const code = await session.sock.requestPairingCode(phone);
    res.json({ code });
  } catch (err) {
    console.error("Pairing code error:", err);
    res.status(500).json({ error: "Failed to generate pairing code. Check the number and try again." });
  }
});

app.listen(PORT, () => {
  console.log(`Pairing page running on port ${PORT}`);
});

// Starts (or returns the already-running) session for one phone number.
// Each session is fully independent: its own socket, its own Supabase-stored
// auth state (namespaced by phone), its own QR/pairing flow.
async function startSession(phone) {
  const existing = sessions.get(phone);
  if (existing && existing.sock) return existing;

  const session = { sock: null, qr: null, status: "pairing", hasAlertedOwner: false };
  sessions.set(phone, session);

  const { state, saveCreds, clearSession } = await useSupabaseAuthState(phone);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
  });
  session.sock = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      session.qr = qr;
      session.status = "pairing";
      console.log(`[${phone}] New QR/pairing code generated.`);
    }

    if (connection === "close") {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      console.log(`[${phone}] Connection closed. Reconnecting:`, !loggedOut, "| reason:", statusCode);

      sessions.delete(phone);

      if (loggedOut) {
        await clearSession();
        await removeSession(phone);
        console.log(`[${phone}] Logged out. Session cleared — they'll need to pair fresh.`);
      } else {
        await upsertSession(phone, "disconnected");
        startSession(phone); // reconnect with the same stored credentials
      }
    } else if (connection === "open") {
      session.qr = null;
      session.status = "connected";
      await upsertSession(phone, "connected");
      console.log(`[${phone}] ${BOT_NAME} is connected and online! ✅`);

      if (!session.hasAlertedOwner) {
        session.hasAlertedOwner = true;
        const ownerJid = `${phone}@s.whatsapp.net`;
        sock
          .sendMessage(ownerJid, {
            text:
              `✅ *${BOT_NAME}* linked successfully!\n\n` +
              `Bot Name: ${BOT_NAME}\n` +
              `Prefix: ${PREFIX}\n` +
              `Mode: ${MODE}\n` +
              `Commands: ${TOTAL_COMMANDS}\n` +
              `Developer: ${DEVELOPER}\n\n` +
              `Send *${PREFIX}menu* to see all commands.\n\n` +
              `This bot is now linked to your own number — you're the owner of this instance.`,
          })
          .catch((err) => console.error(`[${phone}] Failed to send link alert:`, err));
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    console.log(`[${phone}] [MSG UPSERT] type=${type} count=${messages.length}`);
    if (type !== "notify") return;

    const msg = messages[0];
    if (!msg.message) {
      console.log(`[${phone}] [MSG UPSERT] message had no content (likely a protocol/system message), skipping`);
      return;
    }

    try {
      // Each session's owner is whoever linked that number — not a shared global owner.
      await handleMessage(sock, msg, { PREFIX, OWNER_NUMBER: phone, BOT_NAME, botPhone: phone });
    } catch (err) {
      console.error(`[${phone}] Error handling message:`, err);
    }
  });

  return session;
}

// On boot, reconnect every session that was previously linked and not logged out,
// so a Render redeploy doesn't force everyone to re-scan.
async function resumeAllSessions() {
  const phones = await getResumableSessions();
  console.log(`Resuming ${phones.length} previously linked session(s)...`);
  for (const phone of phones) {
    startSession(phone).catch((err) => console.error(`[${phone}] Failed to resume:`, err));
  }
}

resumeAllSessions();
      
