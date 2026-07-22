"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth/current-user";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { writeAgentLog } from "@/lib/mutations/log";

type Envelope<T> =
  | { ok: true; data: T; agent_log_id: string | null }
  | { ok: false; error: { code: string; message: string } };

// --- kill switch ---

const enabledSchema = z.object({ enabled: z.boolean() });

export async function setOutreachEnabled(
  input: z.infer<typeof enabledSchema>,
): Promise<Envelope<{ enabled: boolean }>> {
  const parsed = enabledSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: { code: "INVALID_ARGS", message: "Datos inválidos." } };
  const user = await currentUser();
  if (!user)
    return { ok: false, error: { code: "NOT_AUTH", message: "No autenticado." } };

  const supa = createServiceRoleClient();
  const startedAt = Date.now();
  const { error } = await supa
    .from("app_settings")
    .upsert({ key: "outreach_enabled", value: parsed.data.enabled });
  if (error)
    return { ok: false, error: { code: "DB_ERROR", message: error.message } };

  const agentLogId = await writeAgentLog({
    source: "WEB",
    toolCalled: "web:wa-set-outreach-enabled",
    actionType: "outreach.kill_switch_set",
    requestSummary: `Kill switch → ${parsed.data.enabled ? "ON" : "OFF"}.`,
    responseSummary: "OK.",
    entitiesAffected: [{ table: "app_settings", id: "outreach_enabled" }],
    status: "SUCCESS",
    durationMs: Date.now() - startedAt,
    requestedByUserId: user.id,
  });

  revalidatePath("/wa");
  return { ok: true, data: { enabled: parsed.data.enabled }, agent_log_id: agentLogId };
}

// --- approvals ---

const reviewSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(["APPROVED", "REJECTED"]),
});

export async function reviewApproval(
  input: z.infer<typeof reviewSchema>,
): Promise<Envelope<{ id: string; status: string }>> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: { code: "INVALID_ARGS", message: "Datos inválidos." } };
  const user = await currentUser();
  if (!user)
    return { ok: false, error: { code: "NOT_AUTH", message: "No autenticado." } };

  const supa = createServiceRoleClient();
  const startedAt = Date.now();

  // Guard on PENDING so a concurrent review loses cleanly.
  const { data, error } = await supa
    .from("pending_approvals")
    .update({
      status: parsed.data.decision,
      reviewed_by_id: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id)
    .eq("status", "PENDING")
    .select("id, status, companies(name)")
    .maybeSingle();
  if (error)
    return { ok: false, error: { code: "DB_ERROR", message: error.message } };
  if (!data)
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Aprobación ya revisada o inexistente." },
    };

  const companyName =
    (data.companies as unknown as { name: string } | null)?.name ?? "?";
  const agentLogId = await writeAgentLog({
    source: "WEB",
    toolCalled: "web:wa-review-approval",
    actionType: "outreach.approval_mark",
    requestSummary: `Aprobación de ${companyName} → ${parsed.data.decision}.`,
    responseSummary: "OK.",
    entitiesAffected: [{ table: "pending_approvals", id: data.id }],
    status: "SUCCESS",
    durationMs: Date.now() - startedAt,
    requestedByUserId: user.id,
  });

  revalidatePath("/wa");
  return { ok: true, data: { id: data.id, status: data.status }, agent_log_id: agentLogId };
}

// --- templates ---

const templateSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9_]{3,60}$/, "El id debe ser un slug: minúsculas, números y _."),
  channel: z.enum(["WHATSAPP", "EMAIL"]),
  stageTrigger: z.enum([
    "LEAD",
    "PROSPECT",
    "ACTIVE_CLIENT",
    "PAST_CLIENT",
    "DISQUALIFIED",
  ]),
  vertical: z.string().trim().max(60).nullable(),
  body: z.string().trim().min(1, "El cuerpo no puede estar vacío."),
  variablesRequired: z.array(z.string().regex(/^\w+$/)).max(10),
  sendDelayHours: z.number().int().min(0).max(24 * 30),
  sendWindow: z
    .object({
      days: z.array(z.number().int().min(1).max(7)).min(1),
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
    })
    .nullable(),
  nextTemplateId: z.string().nullable(),
  active: z.boolean(),
});

export async function upsertTemplate(
  input: z.infer<typeof templateSchema>,
): Promise<Envelope<{ id: string }>> {
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: {
        code: "INVALID_ARGS",
        message: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      },
    };
  const user = await currentUser();
  if (!user)
    return { ok: false, error: { code: "NOT_AUTH", message: "No autenticado." } };

  const d = parsed.data;
  if (d.nextTemplateId === d.id)
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Un template no puede encadenarse a sí mismo." },
    };

  const supa = createServiceRoleClient();
  const startedAt = Date.now();

  if (d.nextTemplateId) {
    const { data: next } = await supa
      .from("message_templates")
      .select("id")
      .eq("id", d.nextTemplateId)
      .maybeSingle();
    if (!next)
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: `Template siguiente ${d.nextTemplateId} no existe.` },
      };
  }

  const { error } = await supa.from("message_templates").upsert({
    id: d.id,
    channel: d.channel,
    stage_trigger: d.stageTrigger,
    vertical: d.vertical || null,
    body: d.body,
    variables_required: d.variablesRequired,
    send_delay_hours: d.sendDelayHours,
    send_window: d.sendWindow,
    next_template_id: d.nextTemplateId,
    active: d.active,
  });
  if (error)
    return { ok: false, error: { code: "DB_ERROR", message: error.message } };

  const agentLogId = await writeAgentLog({
    source: "WEB",
    toolCalled: "web:wa-upsert-template",
    actionType: "outreach.template_upsert",
    requestSummary: `Guardar template ${d.id}.`,
    responseSummary: "OK.",
    entitiesAffected: [{ table: "message_templates", id: d.id }],
    status: "SUCCESS",
    durationMs: Date.now() - startedAt,
    requestedByUserId: user.id,
  });

  revalidatePath("/wa");
  revalidatePath("/wa/templates");
  return { ok: true, data: { id: d.id }, agent_log_id: agentLogId };
}

const activeSchema = z.object({
  id: z.string(),
  active: z.boolean(),
});

export async function setTemplateActive(
  input: z.infer<typeof activeSchema>,
): Promise<Envelope<{ id: string }>> {
  const parsed = activeSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: { code: "INVALID_ARGS", message: "Datos inválidos." } };
  const user = await currentUser();
  if (!user)
    return { ok: false, error: { code: "NOT_AUTH", message: "No autenticado." } };

  const supa = createServiceRoleClient();
  const { data, error } = await supa
    .from("message_templates")
    .update({ active: parsed.data.active })
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();
  if (error)
    return { ok: false, error: { code: "DB_ERROR", message: error.message } };
  if (!data)
    return { ok: false, error: { code: "NOT_FOUND", message: "Template no encontrado." } };

  await writeAgentLog({
    source: "WEB",
    toolCalled: "web:wa-set-template-active",
    actionType: "outreach.template_active_set",
    requestSummary: `Template ${parsed.data.id} → active=${parsed.data.active}.`,
    responseSummary: "OK.",
    entitiesAffected: [{ table: "message_templates", id: parsed.data.id }],
    status: "SUCCESS",
    durationMs: 0,
    requestedByUserId: user.id,
  });

  revalidatePath("/wa/templates");
  return { ok: true, data: { id: data.id }, agent_log_id: null };
}

// --- error queue ---

const clearErrorSchema = z.object({ id: z.string().uuid() });

export async function clearCompanyError(
  input: z.infer<typeof clearErrorSchema>,
): Promise<Envelope<{ id: string }>> {
  const parsed = clearErrorSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: { code: "INVALID_ARGS", message: "Datos inválidos." } };
  const user = await currentUser();
  if (!user)
    return { ok: false, error: { code: "NOT_AUTH", message: "No autenticado." } };

  const supa = createServiceRoleClient();
  const { data, error } = await supa
    .from("companies")
    .update({ next_action: null, next_action_at: null })
    .eq("id", parsed.data.id)
    .like("next_action", "error\\_%")
    .select("id, name")
    .maybeSingle();
  if (error)
    return { ok: false, error: { code: "DB_ERROR", message: error.message } };
  if (!data)
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "La empresa no está en estado de error." },
    };

  await writeAgentLog({
    source: "WEB",
    toolCalled: "web:wa-clear-company-error",
    actionType: "outreach.next_action_set",
    requestSummary: `Limpiar error de secuencia de ${data.name}.`,
    responseSummary: "OK.",
    entitiesAffected: [{ table: "companies", id: data.id }],
    status: "SUCCESS",
    durationMs: 0,
    requestedByUserId: user.id,
  });

  revalidatePath("/wa");
  return { ok: true, data: { id: data.id }, agent_log_id: null };
}
