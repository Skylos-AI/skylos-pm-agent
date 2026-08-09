"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth/current-user";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { writeAgentLog } from "@/lib/mutations/log";

const schema = z
  .object({
    targetUserId: z.string().uuid().optional(),
    message: z.string().min(1, "El mensaje es obligatorio."),
    triggerAt: z.string().min(1, "trigger_at obligatorio."),
    relatedCompanyId: z.string().uuid().nullable().optional(),
    relatedProjectId: z.string().uuid().nullable().optional(),
    relatedTaskId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (d) =>
      [d.relatedCompanyId, d.relatedProjectId, d.relatedTaskId].filter(Boolean)
        .length <= 1,
    { message: "Solo una entidad relacionada por recordatorio." },
  );

type Envelope<T> =
  | { ok: true; data: T; agent_log_id: string | null }
  | { ok: false; error: { code: string; message: string } };

export async function createReminder(
  input: z.infer<typeof schema>,
): Promise<Envelope<{ id: string }>> {
  const parsed = schema.safeParse(input);
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
    return { ok: false, error: { code: "NOT_AUTH", message: "No autenticado." } };

  const supa = createServiceRoleClient();
  const startedAt = Date.now();

  const { data, error } = await supa
    .from("reminders")
    .insert({
      target_user_id: parsed.data.targetUserId ?? user.id,
      related_company_id: parsed.data.relatedCompanyId ?? null,
      related_project_id: parsed.data.relatedProjectId ?? null,
      related_task_id: parsed.data.relatedTaskId ?? null,
      message: parsed.data.message,
      trigger_at: parsed.data.triggerAt,
      created_by_agent: false,
    })
    .select("id")
    .single();

  const durationMs = Date.now() - startedAt;
  if (error || !data) {
    await writeAgentLog({
      source: "WEB",
      toolCalled: "web:create-reminder",
      actionType: "write.reminder_create",
      requestSummary: `Recordatorio desde web.`,
      responseSummary: error?.message ?? "Error",
      status: "ERROR",
      errorMessage: error?.message ?? null,
      durationMs,
      requestedByUserId: user.id,
    });
    return {
      ok: false,
      error: {
        code: "DB_ERROR",
        message: error?.message ?? "Error creando recordatorio.",
      },
    };
  }

  const agentLogId = await writeAgentLog({
    source: "WEB",
    toolCalled: "web:create-reminder",
    actionType: "write.reminder_create",
    requestSummary: `Recordatorio "${parsed.data.message}" desde web.`,
    responseSummary: `Reminder ${data.id} creado.`,
    entitiesAffected: [{ table: "reminders", id: data.id }],
    status: "SUCCESS",
    durationMs,
    requestedByUserId: user.id,
  });

  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  return { ok: true, data: { id: data.id }, agent_log_id: agentLogId };
}

const updateSchema = z.object({
  id: z.string().uuid(),
  message: z.string().min(1, "El mensaje es obligatorio.").optional(),
  triggerAt: z.string().min(1).optional(),
});

export async function updateReminder(
  input: z.infer<typeof updateSchema>,
): Promise<Envelope<{ id: string }>> {
  const parsed = updateSchema.safeParse(input);
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
    return { ok: false, error: { code: "NOT_AUTH", message: "No autenticado." } };

  const supa = createServiceRoleClient();
  const startedAt = Date.now();

  const patch: Record<string, unknown> = {};
  if (parsed.data.message !== undefined) patch.message = parsed.data.message;
  if (parsed.data.triggerAt !== undefined)
    patch.trigger_at = parsed.data.triggerAt;

  if (Object.keys(patch).length === 0) {
    return {
      ok: false,
      error: { code: "INVALID_ARGS", message: "Nada para actualizar." },
    };
  }

  const { data, error } = await supa
    .from("reminders")
    .update(patch)
    .eq("id", parsed.data.id)
    .eq("status", "PENDING")
    .select("id")
    .single();

  const durationMs = Date.now() - startedAt;
  if (error || !data) {
    await writeAgentLog({
      source: "WEB",
      toolCalled: "web:update-reminder",
      actionType: "write.reminder_update",
      requestSummary: `Editar recordatorio ${parsed.data.id}.`,
      responseSummary: error?.message ?? "No editable (¿ya enviado?).",
      status: "ERROR",
      errorMessage: error?.message ?? null,
      durationMs,
      requestedByUserId: user.id,
    });
    return {
      ok: false,
      error: {
        code: "DB_ERROR",
        message:
          error?.message ??
          "No se pudo editar (el recordatorio ya fue enviado o cancelado).",
      },
    };
  }

  const agentLogId = await writeAgentLog({
    source: "WEB",
    toolCalled: "web:update-reminder",
    actionType: "write.reminder_update",
    requestSummary: `Editar recordatorio ${parsed.data.id}.`,
    responseSummary: "Recordatorio actualizado.",
    entitiesAffected: [{ table: "reminders", id: data.id }],
    status: "SUCCESS",
    durationMs,
    requestedByUserId: user.id,
  });

  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  return { ok: true, data: { id: data.id }, agent_log_id: agentLogId };
}

const cancelSchema = z.object({ id: z.string().uuid() });

export async function cancelReminder(
  input: z.infer<typeof cancelSchema>,
): Promise<Envelope<{ id: string }>> {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: { code: "INVALID_ARGS", message: "Datos inválidos." },
    };

  const user = await currentUser();
  if (!user)
    return { ok: false, error: { code: "NOT_AUTH", message: "No autenticado." } };

  const supa = createServiceRoleClient();
  const startedAt = Date.now();

  const { data, error } = await supa
    .from("reminders")
    .update({ status: "CANCELLED" })
    .eq("id", parsed.data.id)
    .eq("status", "PENDING")
    .select("id")
    .single();

  const durationMs = Date.now() - startedAt;
  if (error || !data) {
    return {
      ok: false,
      error: {
        code: "DB_ERROR",
        message:
          error?.message ??
          "No se pudo cancelar (ya fue enviado o cancelado).",
      },
    };
  }

  await writeAgentLog({
    source: "WEB",
    toolCalled: "web:cancel-reminder",
    actionType: "write.reminder_cancel",
    requestSummary: `Cancelar recordatorio ${parsed.data.id}.`,
    responseSummary: "Recordatorio cancelado.",
    entitiesAffected: [{ table: "reminders", id: data.id }],
    status: "SUCCESS",
    durationMs,
    requestedByUserId: user.id,
  });

  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  return { ok: true, data: { id: data.id }, agent_log_id: null };
}
