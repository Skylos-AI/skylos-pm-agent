"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAllowed } from "@/lib/auth/allowlist";

const schema = z.object({
  email: z.string().email("Correo inválido."),
});

export type LoginResult =
  | { ok: true; sentTo: string }
  | { ok: false; code: "INVALID" | "NOT_ALLOWED" | "SEND_FAILED"; message: string };

export async function sendMagicLink(formData: FormData): Promise<LoginResult> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { ok: false, code: "INVALID", message: parsed.error.issues[0].message };
  }
  const email = parsed.data.email.toLowerCase();

  if (!isAllowed(email)) {
    return {
      ok: false,
      code: "NOT_ALLOWED",
      message: "Ese correo no está en el equipo de Skylos.",
    };
  }

  const supa = await createClient();
  const { error } = await supa.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) {
    return { ok: false, code: "SEND_FAILED", message: error.message };
  }
  return { ok: true, sentTo: email };
}
