const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn(
    "⚠️  SUPABASE_URL or SUPABASE_KEY not set. Storage features will not work."
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Records/updates the user, and logs the message
async function logMessage({ jid, sender, body, command }) {
  try {
    // Upsert the user (create if new, update last_seen if existing)
    const { data: existing } = await supabase
      .from("users")
      .select("message_count")
      .eq("jid", jid)
      .maybeSingle();

    await supabase.from("users").upsert({
      jid,
      last_seen: new Date().toISOString(),
      message_count: (existing?.message_count || 0) + 1,
    });

    // Log the message itself
    await supabase.from("messages").insert({
      jid,
      sender,
      body,
      command,
    });
  } catch (err) {
    console.error("Supabase logging error:", err.message);
  }
}

module.exports = { supabase, logMessage };
