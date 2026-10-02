const { initAuthCreds, BufferJSON } = require("@whiskeysockets/baileys");
const { supabase } = require("./supabase");

const TABLE = "auth_state";

async function readData(key) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    console.error(`[AUTH STATE] Failed to read "${key}" from Supabase:`, error);
    return null;
  }
  if (!data) return null;
  try {
    return JSON.parse(data.value, BufferJSON.reviver);
  } catch (err) {
    console.error(`[AUTH STATE] Failed to parse "${key}":`, err);
    return null;
  }
}

async function writeData(key, value) {
  const json = JSON.stringify(value, BufferJSON.replacer);
  const { error } = await supabase.from(TABLE).upsert({ key, value: json });
  if (error) {
    console.error(`[AUTH STATE] Failed to save "${key}" to Supabase:`, error);
  }
}

async function removeData(key) {
  await supabase.from(TABLE).delete().eq("key", key);
}

// Drop-in replacement for Baileys' useMultiFileAuthState, storing everything in Supabase
// instead of local disk, so sessions survive Render redeploys.
//
// sessionId namespaces every key (e.g. "254111783552:creds") so many independent
// WhatsApp sessions can share the same Supabase table without colliding.
async function useSupabaseAuthState(sessionId) {
  const ns = (key) => `${sessionId}:${key}`;

  const creds = (await readData(ns("creds"))) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              const value = await readData(ns(`${type}-${id}`));
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = ns(`${category}-${id}`);
              tasks.push(value ? writeData(key, value) : removeData(key));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async () => {
      await writeData(ns("creds"), creds);
    },
    // Wipes every stored key for this session (used on logout, so a fresh
    // pairing starts from a clean slate instead of a half-dead old session).
    clearSession: async () => {
      await supabase.from(TABLE).delete().like("key", `${sessionId}:%`);
    },
  };
}

module.exports = { useSupabaseAuthState };
                    
