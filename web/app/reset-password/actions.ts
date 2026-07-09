"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const schema = z
  .object({
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
    confirm: z.string().min(1),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Las contraseñas no coinciden.",
  });

export type ResetResult = {
  ok: false;
  code:
    | "INVALID"
    | "PASSWORD_TOO_SHORT"
    | "PASSWORD_MISMATCH"
    | "SESSION_EXPIRED"
    | "UPDATE_FAILED";
  message: string;
};

export async function setNewPassword(formData: FormData): Promise<ResetResult> {
  const parsed = schema.safeParse({
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

  const supa = await createClient();
  const { data: userData } = await supa.auth.getUser();
  if (!userData.user) {
    return {
      ok: false,
      code: "SESSION_EXPIRED",
      message: "El enlace expiró. Pedí uno nuevo.",
    };
  }

  const { error } = await supa.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { ok: false, code: "UPDATE_FAILED", message: error.message };
  }

  redirect("/dashboard");
}
