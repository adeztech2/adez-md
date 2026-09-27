const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const pino = require("pino");
const qrcode = require("qrcode-terminal");
const path = require("path");

const { handleMessage } = require("./lib/router");

// Your WhatsApp number (used to recognize owner commands)
const OWNER_NUMBER = "254111783552";
const BOT_NAME = "ADEZ MD";
const PREFIX = ".";

async function startBot() {
  // Where the login session is saved, so you don't have to scan the QR every restart
  const { state, saveCreds } = await useMultiFileAuthState(
    path.join(__dirname, "auth_info")
  );

  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
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
      console.log("\nScan this QR code with WhatsApp (Linked Devices):\n");
      qrcode.generate(qr, { small: true });
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
      console.log(`${BOT_NAME} is connected and online! ✅`);
    }
  });

  // Handle incoming messages
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    try {
      await handleMessage(sock, msg, { PREFIX, OWNER_NUMBER, BOT_NAME });
    } catch (err) {
      console.error("Error handling message:", err);
    }
  });
}

startBot().catch((err) => console.error("Failed to start bot:", err));
