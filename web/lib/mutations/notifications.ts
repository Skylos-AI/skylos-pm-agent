"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth/current-user";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type Envelope<T> =
  | { ok: true; data: T; agent_log_id: string | null }
  | { ok: false; error: { code: string; message: string } };

const markReadSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
});

export async function markNotificationsRead(
  input: z.infer<typeof markReadSchema>,
): Promise<Envelope<{ count: number }>> {
  const parsed = markReadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "INVALID_ARGS",
        message: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      },
    };
  }
  const user = await currentUser();
  if (!user)
    return {
      ok: false,
      error: { code: "NOT_AUTH", message: "No autenticado." },
    };

  const supa = createServiceRoleClient();
  const { data, error } = await supa
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", parsed.data.ids)
    .eq("user_id", user.id)
    .is("read_at", null)
    .select("id");

  if (error)
    return {
      ok: false,
      error: { code: "DB_ERROR", message: error.message },
    };

  revalidatePath("/");
  return {
    ok: true,
    data: { count: data?.length ?? 0 },
    agent_log_id: null,
  };
}

export async function markAllNotificationsRead(): Promise<
  Envelope<{ count: number }>
> {
  const user = await currentUser();
  if (!user)
    return {
      ok: false,
      error: { code: "NOT_AUTH", message: "No autenticado." },
    };

  const supa = createServiceRoleClient();
  const { data, error } = await supa
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null)
    .select("id");

  if (error)
    return {
      ok: false,
      error: { code: "DB_ERROR", message: error.message },
    };

  revalidatePath("/");
  return {
    ok: true,
    data: { count: data?.length ?? 0 },
    agent_log_id: null,
  };
}
