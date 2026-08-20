"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth/current-user";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { writeAgentLog } from "@/lib/mutations/log";

const STATUSES = [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "IN_REVIEW",
  "DONE",
] as const;
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
  reviewerIds: z.array(z.string().uuid()).max(10).default([]),
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

  // Reviewers (optional). De-dupe and drop the assignee — self-review is
  // pointless. Notify each reviewer so they know a review is coming.
  const reviewerIds = Array.from(new Set(parsed.data.reviewerIds)).filter(
    (id) => id !== (parsed.data.assigneeId ?? user.id),
  );
  if (reviewerIds.length > 0) {
    await supa.from("task_reviewers").insert(
      reviewerIds.map((uid) => ({ task_id: data.id, user_id: uid })),
    );
    await supa.from("notifications").insert(
      reviewerIds.map((uid) => ({
        user_id: uid,
        kind: "TASK_REVIEW_REQUESTED" as const,
        body: `${user.full_name ?? "Alguien"} te sumó como revisor de "${parsed.data.title}".`,
        source_task_id: data.id,
        source_user_id: user.id,
      })),
    );
  }

  // Notify the assignee if they're not the creator.
  const assigneeId = parsed.data.assigneeId ?? user.id;
  if (assigneeId !== user.id) {
    await supa.from("notifications").insert({
      user_id: assigneeId,
      kind: "TASK_ASSIGNED",
      body: `${user.full_name ?? "Alguien"} te asignó "${parsed.data.title}".`,
      source_task_id: data.id,
      source_user_id: user.id,
    });
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
    .select("id, title, status, project_id, assignee_id")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!existing)
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Tarea no encontrada." },
    };

  // Review gate: if the caller is trying to mark DONE but the task has
  // reviewers who haven't approved yet, we auto-park it in IN_REVIEW and
  // notify the reviewers. This is the "practical" path — no separate
  // "submit for review" button needed.
  let effectiveStatus = parsed.data.status;
  if (parsed.data.status === "DONE") {
    const { data: reviewers } = await supa
      .from("task_reviewers")
      .select("user_id, approved_at")
      .eq("task_id", parsed.data.id);
    const pending = (reviewers ?? []).filter((r) => !r.approved_at);
    if (pending.length > 0) {
      effectiveStatus = "IN_REVIEW";
      // Only notify when leaving a non-review state — avoids re-notifying on
      // repeated "mark done" clicks while the task is already IN_REVIEW.
      if (existing.status !== "IN_REVIEW") {
        await supa.from("notifications").insert(
          pending.map((r) => ({
            user_id: r.user_id,
            kind: "TASK_REVIEW_REQUESTED" as const,
            body: `"${existing.title}" está lista para tu revisión.`,
            source_task_id: existing.id,
            source_user_id: user.id,
          })),
        );
      }
    }
  }

  const { data, error } = await supa
    .from("tasks")
    .update({
      status: effectiveStatus,
      completed_at:
        effectiveStatus === "DONE" ? new Date().toISOString() : null,
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

// =====================================================================
// Reviewer management
// =====================================================================

const setReviewersSchema = z.object({
  taskId: z.string().uuid(),
  reviewerIds: z.array(z.string().uuid()).max(10),
});

export async function setTaskReviewers(
  input: z.infer<typeof setReviewersSchema>,
): Promise<Envelope<{ taskId: string; added: number; removed: number }>> {
  const parsed = setReviewersSchema.safeParse(input);
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

  const { data: task } = await supa
    .from("tasks")
    .select("id, title, assignee_id, project_id")
    .eq("id", parsed.data.taskId)
    .maybeSingle();
  if (!task)
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Tarea no encontrada." },
    };

  const nextIds = Array.from(new Set(parsed.data.reviewerIds)).filter(
    (id) => id !== task.assignee_id,
  );

  const { data: existing } = await supa
    .from("task_reviewers")
    .select("user_id")
    .eq("task_id", parsed.data.taskId);
  const currentIds = new Set((existing ?? []).map((r) => r.user_id));

  const toAdd = nextIds.filter((id) => !currentIds.has(id));
  const toRemove = Array.from(currentIds).filter((id) => !nextIds.includes(id));

  if (toRemove.length > 0) {
    await supa
      .from("task_reviewers")
      .delete()
      .eq("task_id", parsed.data.taskId)
      .in("user_id", toRemove);
  }

  if (toAdd.length > 0) {
    await supa.from("task_reviewers").insert(
      toAdd.map((uid) => ({ task_id: parsed.data.taskId, user_id: uid })),
    );
    await supa.from("notifications").insert(
      toAdd.map((uid) => ({
        user_id: uid,
        kind: "TASK_REVIEW_REQUESTED" as const,
        body: `${user.full_name ?? "Alguien"} te sumó como revisor de "${task.title}".`,
        source_task_id: task.id,
        source_user_id: user.id,
      })),
    );
  }

  revalidatePath("/tasks");
  if (task.project_id) revalidatePath(`/projects/${task.project_id}`);
  return {
    ok: true,
    data: {
      taskId: parsed.data.taskId,
      added: toAdd.length,
      removed: toRemove.length,
    },
    agent_log_id: null,
  };
}

const approveSchema = z.object({
  taskId: z.string().uuid(),
  comment: z.string().max(1000).optional(),
});

export async function approveTaskAsReviewer(
  input: z.infer<typeof approveSchema>,
): Promise<Envelope<{ taskId: string; movedToDone: boolean }>> {
  const parsed = approveSchema.safeParse(input);
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

  const { data: reviewer } = await supa
    .from("task_reviewers")
    .select("id, approved_at")
    .eq("task_id", parsed.data.taskId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!reviewer) {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "No sos revisor de esta tarea.",
      },
    };
  }

  await supa
    .from("task_reviewers")
    .update({
      approved_at: new Date().toISOString(),
      rejected_at: null,
      comment: parsed.data.comment ?? null,
    })
    .eq("id", reviewer.id);

  // Auto-transition to DONE when every reviewer has approved.
  const { data: all } = await supa
    .from("task_reviewers")
    .select("approved_at")
    .eq("task_id", parsed.data.taskId);
  const allApproved =
    (all ?? []).length > 0 && (all ?? []).every((r) => r.approved_at);

  let movedToDone = false;
  if (allApproved) {
    const { data: task } = await supa
      .from("tasks")
      .select("id, title, assignee_id, project_id")
      .eq("id", parsed.data.taskId)
      .maybeSingle();
    if (task) {
      await supa
        .from("tasks")
        .update({
          status: "DONE",
          completed_at: new Date().toISOString(),
        })
        .eq("id", task.id);
      movedToDone = true;
      if (task.assignee_id) {
        await supa.from("notifications").insert({
          user_id: task.assignee_id,
          kind: "TASK_COMPLETED",
          body: `Todos aprobaron "${task.title}". Marcada como hecha.`,
          source_task_id: task.id,
          source_user_id: user.id,
        });
      }
      if (task.project_id) revalidatePath(`/projects/${task.project_id}`);
    }
  } else {
    // Only notify the assignee about the individual approval when still pending.
    const { data: task } = await supa
      .from("tasks")
      .select("id, title, assignee_id, project_id")
      .eq("id", parsed.data.taskId)
      .maybeSingle();
    if (task && task.assignee_id && task.assignee_id !== user.id) {
      await supa.from("notifications").insert({
        user_id: task.assignee_id,
        kind: "TASK_APPROVED",
        body: `${user.full_name ?? "Un revisor"} aprobó "${task.title}".`,
        source_task_id: task.id,
        source_user_id: user.id,
      });
      if (task.project_id) revalidatePath(`/projects/${task.project_id}`);
    }
  }

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return {
    ok: true,
    data: { taskId: parsed.data.taskId, movedToDone },
    agent_log_id: null,
  };
}

const rejectSchema = z.object({
  taskId: z.string().uuid(),
  comment: z
    .string()
    .trim()
    .min(1, "Explicá el rechazo para que el asignado sepa qué corregir.")
    .max(1000),
});

export async function rejectTaskAsReviewer(
  input: z.infer<typeof rejectSchema>,
): Promise<Envelope<{ taskId: string }>> {
  const parsed = rejectSchema.safeParse(input);
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

  const { data: reviewer } = await supa
    .from("task_reviewers")
    .select("id")
    .eq("task_id", parsed.data.taskId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!reviewer) {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "No sos revisor de esta tarea.",
      },
    };
  }

  const { data: task } = await supa
    .from("tasks")
    .select("id, title, assignee_id, project_id")
    .eq("id", parsed.data.taskId)
    .maybeSingle();
  if (!task) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Tarea no encontrada." },
    };
  }

  // Record this reviewer's rejection with the comment.
  await supa
    .from("task_reviewers")
    .update({
      rejected_at: new Date().toISOString(),
      approved_at: null,
      comment: parsed.data.comment,
    })
    .eq("id", reviewer.id);

  // Clear other reviewers' prior approvals — after a rejection, everyone
  // reviews the fixed version fresh.
  await supa
    .from("task_reviewers")
    .update({ approved_at: null })
    .eq("task_id", parsed.data.taskId)
    .neq("id", reviewer.id);

  // Send the task back to IN_PROGRESS and log the rejection as a note so it
  // shows in the task's thread.
  await supa
    .from("tasks")
    .update({ status: "IN_PROGRESS", completed_at: null })
    .eq("id", task.id);

  await supa.from("task_notes").insert({
    task_id: task.id,
    author_id: user.id,
    author_agent: false,
    body: `Revisión rechazada: ${parsed.data.comment}`,
  });

  if (task.assignee_id && task.assignee_id !== user.id) {
    await supa.from("notifications").insert({
      user_id: task.assignee_id,
      kind: "TASK_REJECTED",
      body: `${user.full_name ?? "Un revisor"} pidió cambios en "${task.title}".`,
      source_task_id: task.id,
      source_user_id: user.id,
    });
  }

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  if (task.project_id) revalidatePath(`/projects/${task.project_id}`);
  return {
    ok: true,
    data: { taskId: parsed.data.taskId },
    agent_log_id: null,
  };
}
