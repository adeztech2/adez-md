const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const commandsDir = path.join(__dirname, '..', 'commands');
const observersDir = path.join(__dirname, '..', 'observers');

const commands = new Map();
const observers = [];

function getAllFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  let results = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results = results.concat(getAllFiles(fullPath));
    } else if (item.name.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

async function loadCommands() {
  commands.clear();
  const files = getAllFiles(commandsDir);

  for (const file of files) {
    try {
      const fileUrl = pathToFileURL(file).href;
      const mod = await import(fileUrl + `?update=${Date.now()}`);

      if (!mod.name) {
        console.warn(`⚠️ Skipped ${path.basename(file)}: missing export const name`);
        continue;
      }

      if (commands.has(mod.name)) {
        console.warn(`⚠️ Duplicate command "${mod.name}" in ${path.basename(file)} — skipped, already loaded from another file.`);
        continue;
      }

      commands.set(mod.name, {
        name: mod.name,
        category: mod.category || 'Uncategorized',
        execute: mod.execute || mod.default,
        adminOnly: mod.adminOnly || false,
        ownerOnly: mod.ownerOnly || false
      });

      console.log(`✅ Loaded: ${mod.name} [${mod.category || 'Uncategorized'}]`);
    } catch (err) {
      console.error(`❌ FAILED ${path.basename(file)}: ${err.message}`);
      console.error(err.stack);
    }
  }

  await loadObservers();
  console.log(`📦 Total commands loaded: ${commands.size}`);
}

async function loadObservers() {
  observers.length = 0;
  const files = getAllFiles(observersDir);

  for (const file of files) {
    try {
      const fileUrl = pathToFileURL(file).href;
      const mod = await import(fileUrl + `?update=${Date.now()}`);
      if (mod.execute || mod.default) {
        observers.push(mod.execute || mod.default);
        console.log(`✅ Loaded observer: ${path.basename(file)}`);
      }
    } catch (err) {
      console.error(`❌ FAILED observer ${path.basename(file)}: ${err.message}`);
      console.error(err.stack);
    }
  }
}

function getAllCommands() {
  return Array.from(commands.values());
}

async function resolveLidToJid(sock, groupJid, lid) {
  try {
    const metadata = await sock.groupMetadata(groupJid);
    const participant = metadata.participants.find(p => p.id === lid || p.lid === lid);
    if (participant) return participant.id.includes('@s.whatsapp.net') ? participant.id : participant.jid || lid;
    return lid;
  } catch (err) {
    console.error('❌ Failed to resolve LID to JID:', err.message);
    return lid;
  }
}

async function getAdminStatus(sock, groupJid, senderJid) {
  try {
    const groupMetadata = await sock.groupMetadata(groupJid);
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

    const senderParticipant = groupMetadata.participants.find(p => p.id === senderJid);
    const botParticipant = groupMetadata.participants.find(p => p.id.startsWith(botJid.split('@')[0]));

    const isAdmin = senderParticipant?.admin === 'admin' || senderParticipant?.admin === 'superadmin';
    const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';

    return { isAdmin: !!isAdmin, isBotAdmin: !!isBotAdmin, groupMetadata };
  } catch (err) {
    return { isAdmin: false, isBotAdmin: false, groupMetadata: null };
  }
}

async function handleMessage(sock, m) {
  const msg = m.messages[0];
  if (!msg.message || msg.key.fromMe) return;

  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const isGroup = from.endsWith('@g.us');
  const prefix = process.env.PREFIX || '.';

  const body =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    '';

  for (const observer of observers) {
    try {
      await observer(sock, msg, { from, sender, isGroup, body });
    } catch (err) {
      console.error('❌ Observer error:', err.message);
    }
  }

  if (!body.startsWith(prefix)) return;

  const args = body.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const command = commands.get(commandName);

  if (!command) return;

  let isAdmin = false, isBotAdmin = false, groupMetadata = null;
  if (isGroup) {
    const adminStatus = await getAdminStatus(sock, from, sender);
    isAdmin = adminStatus.isAdmin;
    isBotAdmin = adminStatus.isBotAdmin;
    groupMetadata = adminStatus.groupMetadata;
  }

  const ownerNumber = (process.env.OWNER_NUMBER || '') + '@s.whatsapp.net';
  const isOwner = sender === ownerNumber;

  if (command.ownerOnly && !isOwner) {
    return sock.sendMessage(from, { text: '❌ This command is for the owner only.' }, { quoted: msg });
  }
  if (command.adminOnly && !isAdmin && !isOwner) {
    return sock.sendMessage(from, { text: '❌ This command is for group admins only.' }, { quoted: msg });
  }

  try {
    await command.execute(sock, msg, {
      args,
      from,
      sender,
      isGroup,
      isAdmin,
      isBotAdmin,
      isOwner,
      groupMetadata,
      resolveLidToJid
    });
  } catch (err) {
    console.error(`❌ FAILED command "${commandName}": ${err.message}`);
    console.error(err.stack);
    await sock.sendMessage(from, { text: `❌ Error running .${commandName}: ${err.message}` }, { quoted: msg });
  }
}

module.exports = { loadCommands, handleMessage, getAllCommands };
