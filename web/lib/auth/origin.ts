import { headers } from "next/headers";

export async function resolveAppOrigin(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv && !fromEnv.includes("localhost")) {
    return fromEnv;
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return fromEnv ?? "http://localhost:3000";
}
