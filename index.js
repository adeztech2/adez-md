const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const pino = require("pino");
const qrcodeTerminal = require("qrcode-terminal");
const qrcode = require("qrcode");
const express = require("express");
const path = require("path");

const { handleMessage } = require("./lib/router");

// Your WhatsApp number (used to recognize owner commands)
const OWNER_NUMBER = "254111783552";
const BOT_NAME = "ADEZ MD";
const PREFIX = ".";
const PORT = process.env.PORT || 3000;

let latestQR = null; // holds the current QR string so the web page can render it
let sock = null; // holds the active socket so routes below can use it

// --- Web server: shows a scannable QR page at your Render URL ---
const app = express();
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "pair.html"));
});

app.get("/qr", async (req, res) => {
  if (!latestQR) {
    res.status(404).send("No QR available");
    return;
  }
  try {
    const buffer = await qrcode.toBuffer(latestQR, { width: 280 });
    res.type("png").send(buffer);
  } catch (err) {
    res.status(500).send("Failed to generate QR");
  }
});

// Request a pairing code for a given phone number (digits only, country code first, no +)
app.get("/request-code", async (req, res) => {
  const number = (req.query.number || "").replace(/[^0-9]/g, "");

  if (!number) {
    res.status(400).json({ error: "Provide a phone number, e.g. ?number=254111783552" });
    return;
  }
  if (!sock) {
    res.status(503).json({ error: "Bot is still starting up. Try again in a few seconds." });
    return;
  }
  if (sock.authState?.creds?.registered) {
    res.status(400).json({ error: "Already connected. No pairing needed." });
    return;
  }

  try {
    const code = await sock.requestPairingCode(number);
    res.json({ code });
  } catch (err) {
    console.error("Pairing code error:", err);
    res.status(500).json({ error: "Failed to generate pairing code. Check the number and try again." });
  }
});

app.listen(PORT, () => {
  console.log(`Pairing page running on port ${PORT}`);
});

async function startBot() {
  // Where the login session is saved, so you don't have to scan the QR every restart
  const { state, saveCreds } = await useMultiFileAuthState(
    path.join(__dirname, "auth_info")
  );

  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }), // set to "info" if you want to see raw logs
    printQRInTerminal: false, // we handle the QR ourselves below
  });

  // Save login credentials whenever they update
  sock.ev.on("creds.update", saveCreds);

  // Handle connection open/close/QR events
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQR = qr;
      console.log("\nNew QR generated. Visit your Render URL to scan it.");
      console.log("(Or scan this in the terminal if running locally):\n");
      qrcodeTerminal.generate(qr, { small: true });
    }

    if (connection === "close") {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(
        "Connection closed. Reconnecting:",
        shouldReconnect,
        "| reason:",
        statusCode
      );

      if (shouldReconnect) {
        startBot();
      } else {
        console.log("Logged out. Delete the auth_info folder and restart to re-login.");
      }
    } else if (connection === "open") {
      latestQR = null;
      console.log(`${BOT_NAME} is connected and online! ✅`);
    }
  });

  // Handle incoming messages
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    const msg = messages[0];
    if (!msg.message) return;

    try {
      await handleMessage(sock, msg, { PREFIX, OWNER_NUMBER, BOT_NAME });
    } catch (err) {
      console.error("Error handling message:", err);
    }
  });
}

startBot().catch((err) => console.error("Failed to start bot:", err));
