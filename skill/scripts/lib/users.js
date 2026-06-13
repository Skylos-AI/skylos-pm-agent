const { getClient } = require("./supabase");
const { appError } = require("./envelope");

async function resolveUser(emailOrUndef) {
  const email = emailOrUndef || process.env.SKYLOS_AS_USER;
  if (!email) {
    throw appError(
      "INVALID_ARGS",
      "--as-user <email> is required (or set SKYLOS_AS_USER env var).",
    );
  }
  const supa = getClient();
  const { data, error } = await supa
    .from("users")
    .select("id, email, full_name, role")
    .eq("email", email)
    .maybeSingle();
  if (error) {
    throw appError("DB_ERROR", error.message, { pg_code: error.code });
  }
  if (!data) {
    throw appError("NOT_FOUND", `Usuario no encontrado: ${email}`);
  }
  return data;
}

module.exports = { resolveUser };
