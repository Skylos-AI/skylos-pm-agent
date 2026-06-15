import "server-only";

export function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.SKYLOS_TEAM_ALLOWLIST ?? "";
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
