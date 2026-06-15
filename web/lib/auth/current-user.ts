import "server-only";
import { createClient } from "@/lib/supabase/server";

export type SkylosUser = {
  id: string;
  email: string;
  full_name: string;
  role: "FOUNDER" | "SALES" | "DELIVERY" | "ADMIN";
  timezone: string;
};

export async function currentUser(): Promise<SkylosUser | null> {
  const supa = await createClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user?.email) return null;
  const { data } = await supa
    .from("users")
    .select("id, email, full_name, role, timezone")
    .eq("email", user.email)
    .maybeSingle();
  return (data as SkylosUser) ?? null;
}
