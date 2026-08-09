"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth/current-user";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { writeAgentLog } from "@/lib/mutations/log";

type Envelope<T> =
  | { ok: true; data: T; agent_log_id: string | null }
  | { ok: false; error: { code: string; message: string } };

const createSchema = z.object({
  taskId: z.string().uuid(),
  body: z
    .string()
    .trim()
    .min(1, "La nota no puede estar vacía.")
    .max(2000, "La nota no puede superar 2000 caracteres."),
});

export async function createTaskNote(
  input: z.infer<typeof createSchema>,
): Promise<Envelope<{ id: string }>> {
  const parsed = createSchema.safeParse(input);
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

  const { data: existing } = await supa
    .from("tasks")
    .select("id, title, project_id")
    .eq("id", parsed.data.taskId)
    .maybeSingle();
  if (!existing)
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Tarea no encontrada." },
    };

  const { data, error } = await supa
    .from("task_notes")
    .insert({
      task_id: parsed.data.taskId,
      author_id: user.id,
      author_agent: false,
      body: parsed.data.body,
    })
    .select("id")
    .single();

  const durationMs = Date.now() - startedAt;
  if (error || !data) {
    await writeAgentLog({
      source: "WEB",
      toolCalled: "web:create-task-note",
      actionType: "write.task_note_create",
      requestSummary: `Nota en tarea "${existing.title}" desde web.`,
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
        message: error?.message ?? "Error guardando nota.",
      },
    };
  }

  const agentLogId = await writeAgentLog({
    source: "WEB",
    toolCalled: "web:create-task-note",
    actionType: "write.task_note_create",
    requestSummary: `Nota en tarea "${existing.title}" desde web.`,
    responseSummary: `Nota ${data.id} agregada.`,
    entitiesAffected: [
      { table: "task_notes", id: data.id },
      { table: "tasks", id: existing.id },
    ],
    status: "SUCCESS",
    durationMs,
    requestedByUserId: user.id,
  });

  revalidatePath("/tasks");
  if (existing.project_id) revalidatePath(`/projects/${existing.project_id}`);
  return { ok: true, data: { id: data.id }, agent_log_id: agentLogId };
}

const deleteSchema = z.object({ id: z.string().uuid() });

export async function deleteTaskNote(
  input: z.infer<typeof deleteSchema>,
): Promise<Envelope<{ id: string }>> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: { code: "INVALID_ARGS", message: "Datos inválidos." },
    };

  const user = await currentUser();
  if (!user)
    return { ok: false, error: { code: "NOT_AUTH", message: "No autenticado." } };

  const supa = createServiceRoleClient();

  const { data: note } = await supa
    .from("task_notes")
    .select("id, task_id, author_id, author_agent")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!note)
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Nota no encontrada." },
    };

  if (note.author_agent || note.author_id !== user.id) {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Solo el autor puede borrar su nota.",
      },
    };
  }

  const startedAt = Date.now();
  const { error } = await supa
    .from("task_notes")
    .delete()
    .eq("id", parsed.data.id);
  const durationMs = Date.now() - startedAt;

  if (error) {
    await writeAgentLog({
      source: "WEB",
      toolCalled: "web:delete-task-note",
      actionType: "write.task_note_delete",
      requestSummary: `Borrar nota ${parsed.data.id}.`,
      responseSummary: error.message,
      status: "ERROR",
      errorMessage: error.message,
      durationMs,
      requestedByUserId: user.id,
    });
    return {
      ok: false,
      error: { code: "DB_ERROR", message: error.message },
    };
  }

  const agentLogId = await writeAgentLog({
    source: "WEB",
    toolCalled: "web:delete-task-note",
    actionType: "write.task_note_delete",
    requestSummary: `Borrar nota ${parsed.data.id}.`,
    responseSummary: "Nota eliminada.",
    entitiesAffected: [
      { table: "task_notes", id: parsed.data.id },
      { table: "tasks", id: note.task_id },
    ],
    status: "SUCCESS",
    durationMs,
    requestedByUserId: user.id,
  });

  revalidatePath("/tasks");
  return { ok: true, data: { id: parsed.data.id }, agent_log_id: agentLogId };
}
