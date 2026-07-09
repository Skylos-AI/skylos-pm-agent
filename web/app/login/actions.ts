"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowed } from "@/lib/auth/allowlist";

const schema = z.object({
  email: z.string().email("Correo inválido."),
  password: z.string().min(1, "Contraseña requerida."),
});

export type LoginResult =
  | { ok: false; code: "INVALID" | "NOT_ALLOWED" | "INVALID_CREDENTIALS" | "EMAIL_NOT_CONFIRMED" | "SIGN_IN_FAILED"; message: string };

export async function signInWithPassword(formData: FormData): Promise<LoginResult> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, code: "INVALID", message: parsed.error.issues[0].message };
  }
  const email = parsed.data.email.toLowerCase();
  const password = parsed.data.password;

  if (!isAllowed(email)) {
    return {
      ok: false,
      code: "NOT_ALLOWED",
      message: "Ese correo no está en el equipo de Skylos.",
    };
  }

  const supa = await createClient();
  const { error } = await supa.auth.signInWithPassword({ email, password });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("email not confirmed")) {
      return {
        ok: false,
        code: "EMAIL_NOT_CONFIRMED",
        message: "Confirmá tu correo antes de iniciar sesión — revisá tu bandeja.",
      };
    }
    if (msg.includes("invalid login credentials")) {
      return {
        ok: false,
        code: "INVALID_CREDENTIALS",
        message: "Correo o contraseña incorrectos.",
      };
    }
    return { ok: false, code: "SIGN_IN_FAILED", message: error.message };
  }

  redirect("/dashboard");
}
