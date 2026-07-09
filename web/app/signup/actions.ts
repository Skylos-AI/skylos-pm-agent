"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAllowed } from "@/lib/auth/allowlist";

const schema = z
  .object({
    email: z.string().email("Correo inválido."),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
    confirm: z.string().min(1),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Las contraseñas no coinciden.",
  });

export type SignupResult =
  | { ok: true; email: string }
  | {
      ok: false;
      code:
        | "INVALID"
        | "NOT_ALLOWED"
        | "PASSWORD_TOO_SHORT"
        | "PASSWORD_MISMATCH"
        | "EMAIL_IN_USE"
        | "SIGN_UP_FAILED";
      message: string;
    };

export async function signUp(formData: FormData): Promise<SignupResult> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path[0];
    if (path === "confirm") {
      return { ok: false, code: "PASSWORD_MISMATCH", message: issue.message };
    }
    if (path === "password") {
      return { ok: false, code: "PASSWORD_TOO_SHORT", message: issue.message };
    }
    return { ok: false, code: "INVALID", message: issue.message };
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
  const { data, error } = await supa.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already registered") || msg.includes("user already")) {
      return {
        ok: false,
        code: "EMAIL_IN_USE",
        message: "Ese correo ya está registrado. Iniciá sesión o restablecé tu contraseña.",
      };
    }
    return { ok: false, code: "SIGN_UP_FAILED", message: error.message };
  }

  // Supabase returns `identities: []` when the email is already registered
  // (with email confirmations on, it doesn't error to avoid enumeration).
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return {
      ok: false,
      code: "EMAIL_IN_USE",
      message: "Ese correo ya está registrado. Iniciá sesión o restablecé tu contraseña.",
    };
  }

  return { ok: true, email };
}
