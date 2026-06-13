const { createClient } = require("@supabase/supabase-js");

let client;

function getClient() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  // Manu's vault convention is SUPABASE_SERVICE_ROLE; Supabase docs use
  // SUPABASE_SERVICE_ROLE_KEY (which is also what .env.example documents).
  // Accept either so both deployment paths work.
  const key =
    process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    const e = new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE / SUPABASE_SERVICE_ROLE_KEY in environment.",
    );
    e.code = "VAULT_ERROR";
    throw e;
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

module.exports = { getClient };
