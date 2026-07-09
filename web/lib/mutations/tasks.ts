"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth/current-user";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { writeAgentLog } from "@/lib/mutations/log";

const STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

const createSchema = z.object({
  title: z.string().min(1, "El título es obligatorio."),
  description: z.string().optional(),
  projectId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().uuid().optional(),
  priority: z.enum(PRIORITIES).default("MEDIUM"),
  dueDate: z.string().nullable().optional(),
  estimatedHours: z.number().int().positive().optional(),
  resources: z.string().optional(),
});

type Envelope<T> =
  | { ok: true; data: T; agent_log_id: string | null }
  | { ok: false; error: { code: string; message: string } };

export async function createTask(
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

  const { data, error } = await supa
    .from("tasks")
    .insert({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      assignee_id: parsed.data.assigneeId ?? user.id,
      project_id: parsed.data.projectId ?? null,
      priority: parsed.data.priority,
      due_date: parsed.data.dueDate ?? null,
      estimated_hours: parsed.data.estimatedHours ?? null,
      resources: parsed.data.resources?.trim() || null,
      created_by_id: user.id,
      created_by_agent: false,
    })
    .select("id")
    .single();

  const durationMs = Date.now() - startedAt;
  if (error || !data) {
    await writeAgentLog({
      source: "WEB",
      toolCalled: "web:create-task",
      actionType: "write.task_create",
      requestSummary: `Crear tarea "${parsed.data.title}" desde web.`,
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
        message: error?.message ?? "Error creando tarea.",
      },
    };
  }

  const agentLogId = await writeAgentLog({
    source: "WEB",
    toolCalled: "web:create-task",
    actionType: "write.task_create",
    requestSummary: `Crear tarea "${parsed.data.title}" desde web.`,
    responseSummary: `Tarea ${data.id} creada.`,
    entitiesAffected: [{ table: "tasks", id: data.id }],
    status: "SUCCESS",
    durationMs,
    requestedByUserId: user.id,
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  if (parsed.data.projectId)
    revalidatePath(`/projects/${parsed.data.projectId}`);
  return { ok: true, data: { id: data.id }, agent_log_id: agentLogId };
}

const updateDescriptionSchema = z.object({
  id: z.string().uuid(),
  description: z.string().max(500, "La nota no puede superar 500 caracteres."),
});

export async function updateTaskDescription(
  input: z.infer<typeof updateDescriptionSchema>,
): Promise<Envelope<{ id: string }>> {
  const parsed = updateDescriptionSchema.safeParse(input);
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
  const trimmed = parsed.data.description.trim();

  const { data: existing } = await supa
    .from("tasks")
    .select("id, title, project_id")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!existing)
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Tarea no encontrada." },
    };

  const { data, error } = await supa
    .from("tasks")
    .update({ description: trimmed.length ? trimmed : null })
    .eq("id", parsed.data.id)
    .select("id")
    .single();

  const durationMs = Date.now() - startedAt;
  if (error || !data) {
    await writeAgentLog({
      source: "WEB",
      toolCalled: "web:update-task-description",
      actionType: "write.task_update_description",
      requestSummary: `Editar nota de tarea ${parsed.data.id}.`,
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
        message: error?.message ?? "Error actualizando nota.",
      },
    };
  }

  const agentLogId = await writeAgentLog({
    source: "WEB",
    toolCalled: "web:update-task-description",
    actionType: "write.task_update_description",
    requestSummary: `Editar nota de tarea "${existing.title}".`,
    responseSummary: trimmed.length ? "Nota actualizada." : "Nota eliminada.",
    entitiesAffected: [{ table: "tasks", id: data.id }],
    status: "SUCCESS",
    durationMs,
    requestedByUserId: user.id,
  });

  revalidatePath("/tasks");
  if (existing.project_id) revalidatePath(`/projects/${existing.project_id}`);
  return { ok: true, data: { id: data.id }, agent_log_id: agentLogId };
}

const updateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(STATUSES),
});

export async function updateTaskStatus(
  input: z.infer<typeof updateStatusSchema>,
): Promise<Envelope<{ id: string; status: string }>> {
  const parsed = updateStatusSchema.safeParse(input);
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
    .select("id, title, status, project_id")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!existing)
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Tarea no encontrada." },
    };

  const { data, error } = await supa
    .from("tasks")
    .update({
      status: parsed.data.status,
      completed_at:
        parsed.data.status === "DONE" ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.id)
    .select("id, status")
    .single();

  const durationMs = Date.now() - startedAt;
  if (error || !data) {
    await writeAgentLog({
      source: "WEB",
      toolCalled: "web:update-task-status",
      actionType: "write.task_update_status",
      requestSummary: `Mover tarea ${parsed.data.id} a ${parsed.data.status}.`,
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
        message: error?.message ?? "Error actualizando tarea.",
      },
    };
  }

  const agentLogId = await writeAgentLog({
    source: "WEB",
    toolCalled: "web:update-task-status",
    actionType: "write.task_update_status",
    requestSummary: `Tarea "${existing.title}" pasó de ${existing.status} a ${parsed.data.status}.`,
    responseSummary: `OK. status=${data.status}.`,
    entitiesAffected: [{ table: "tasks", id: data.id }],
    status: "SUCCESS",
    durationMs,
    requestedByUserId: user.id,
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  if (existing.project_id)
    revalidatePath(`/projects/${existing.project_id}`);
  return {
    ok: true,
    data: { id: data.id, status: data.status },
    agent_log_id: agentLogId,
  };
}
