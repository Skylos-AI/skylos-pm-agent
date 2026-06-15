import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supa = await createClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (user) redirect("/dashboard");
  redirect("/login");
}
