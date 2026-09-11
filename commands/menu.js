module.exports.name = "menu";
module.exports.category = "General";

module.exports.execute = async function (sock, msg, ctx) {
  const { getAllCommands } = require('../lib/router');
  const commands = getAllCommands();
  const prefix = process.env.PREFIX || '.';
  const botName = process.env.BOT_NAME || 'ADEZ MD';

  const grouped = {};
  for (const cmd of commands) {
    if (!grouped[cmd.category]) grouped[cmd.category] = [];
    grouped[cmd.category].push(cmd.name);
  }

  let menuText = `╭─❒ *${botName}* ❒\n│\n`;
  menuText += `│ Total Commands: ${commands.length}\n`;
  menuText += `│ Prefix: ${prefix}\n╰────────────────\n\n`;

  for (const category of Object.keys(grouped).sort()) {
    menuText += `╭─❒ *${category}* ❒\n`;
    for (const name of grouped[category]) {
      menuText += `│ ⊳ ${prefix}${name}\n`;
    }
    menuText += `╰────────────────\n\n`;
  }

  await sock.sendMessage(ctx.from, { text: menuText.trim() }, { quoted: msg });
};
