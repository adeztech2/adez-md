const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const commandsDir = path.join(__dirname, '..', 'commands');
const observersDir = path.join(__dirname, '..', 'observers');

const commands = new Map();
const observers = [];

// --- Recursively find all .js files in a folder ---
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

// --- Load all commands recursively ---
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
        execute: mod.execute ||
