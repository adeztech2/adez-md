// ============================================================
// COMMAND ROUTER
// Loads command modules from ./commands and dispatches
// incoming WhatsApp messages to the right handler.
// ============================================================

const fs = require('fs-extra');
const path = require('path');

const COMMANDS_DIR = path.join(__dirname, 'commands');

// name -> command module
const commandMap = new Map();

// ------------------------------------------------------------
// LOAD COMMANDS
// ------------------------------------------------------------

async function loadCommands() {

    commandMap.clear();

    fs.ensureDirSync(COMMANDS_DIR);

    const files = (await fs.readdir(COMMANDS_DIR))
        .filter((file) => file.endsWith('.js'));

    for (const file of files) {

        try {

            const fullPath =
                path.join(COMMANDS_DIR, file);

            // Bust require cache so re-loading picks up edits
            delete require.cache[require.resolve(fullPath)];

            const command =
                require(fullPath);

            if (!command || !command.name || typeof command.execute !== 'function') {

                console.warn(
                    `⚠️ Skipping invalid command file: ${file}`
                );

                continue;

            }

            const names = [
                command.name,
                ...(command.aliases || [])
            ];

            for (const name of names) {

                commandMap.set(
                    name.toLowerCase(),
                    command
                );

            }

        } catch (error) {

            console.error(
                `❌ Failed to load command file "${file}":`,
                error.message
            );

        }

    }

    return commandMap;

}

// ------------------------------------------------------------
// GET ALL COMMANDS (deduplicated by primary name)
// ------------------------------------------------------------

function getAllCommands() {

    const seen = new Set();
    const list = [];

    for (const command of commandMap.values()) {

        if (seen.has(command.name)) continue;

        seen.add(command.name);
        list.push(command);

    }

    return list;

}

// ------------------------------------------------------------
// EXTRACT TEXT FROM A MESSAGE
// ------------------------------------------------------------

function extractText(msg) {

    const m = msg.message || {};

    return (
        m.conversation ||
        m.extendedTextMessage?.text ||
        m.imageMessage?.caption ||
        m.videoMessage?.caption ||
        m.buttonsResponseMessage?.selectedButtonId ||
        m.listResponseMessage?.singleSelectReply?.selectedRowId ||
        ''
    );

}

// ------------------------------------------------------------
// PROCESS INCOMING COMMAND
// ------------------------------------------------------------

async function processCommand(sock, msg, opts = {}) {

    const prefix = opts.prefix || '.';
    const from = msg.key.remoteJid;

    const text =
        extractText(msg).trim();

    if (!text.startsWith(prefix)) {
        return;
    }

    const withoutPrefix =
        text.slice(prefix.length).trim();

    if (!withoutPrefix) {
        return;
    }

    const [rawName, ...args] =
        withoutPrefix.split(/\s+/);

    const commandName =
        rawName.toLowerCase();

    const command =
        commandMap.get(commandName);

    if (!command) {
        return;
    }

    const senderJid =
        msg.key.participant || msg.key.remoteJid;

    const senderNumber =
        String(senderJid || '').split('@')[0];

    const isOwner =
        (opts.ownerNumbers || [])
            .map((n) => String(n).replace(/[^0-9]/g, ''))
            .includes(senderNumber);

    if (command.ownerOnly && !isOwner) {

        await sock.sendMessage(
            from,
            { text: '⛔ This command is restricted to the bot owner.' },
            { quoted: msg }
        );

        return;

    }

    try {

        await command.execute(sock, msg, {
            args,
            text: args.join(' '),
            from,
            prefix,
            botName: opts.botName,
            isOwner
        });

    } catch (error) {

        console.error(
            `❌ Error executing command "${commandName}":`,
            error
        );

        try {

            await sock.sendMessage(
                from,
                { text: `❌ Something went wrong running *${commandName}*.` },
                { quoted: msg }
            );

        } catch (_) {}

    }

}

module.exports = {
    loadCommands,
    getAllCommands,
    processCommand
};
