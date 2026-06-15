"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth/current-user";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { writeAgentLog } from "@/lib/mutations/log";

const TYPES = [
  "CALL",
  "MEETING",
  "MESSAGE_SENT",
  "MESSAGE_RECEIVED",
  "EMAIL",
  "NOTE",
  "MILESTONE",
  "PROPOSAL_SENT",
  "CONTRACT_SIGNED",
] as const;
const CHANNELS = [
  "WHATSAPP",
  "PHONE",
  "IN_PERSON",
  "EMAIL",
  "VIDEO_CALL",
  "OTHER",
] as const;

const schema = z.object({
  companyId: z.string().uuid(),
  type: z.enum(TYPES),
  channel: z.enum(CHANNELS).default("OTHER"),
  description: z.string().min(1, "La descripción es obligatoria."),
  projectId: z.string().uuid().nullable().optional(),
  contactId: z.string().uuid().nullable().optional(),
  occurredAt: z.string().optional(),
});

type Envelope<T> =
  | { ok: true; data: T; agent_log_id: string | null }
  | { ok: false; error: { code: string; message: string } };

export async function logActivity(
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
    .from("activities")
    .insert({
      company_id: parsed.data.companyId,
      contact_id: parsed.data.contactId ?? null,
      project_id: parsed.data.projectId ?? null,
      type: parsed.data.type,
      channel: parsed.data.channel,
      description: parsed.data.description,
      occurred_at: parsed.data.occurredAt ?? new Date().toISOString(),
      logged_by_id: user.id,
      logged_by_agent: false,
    })
    .select("id")
    .single();

  const durationMs = Date.now() - startedAt;
  if (error || !data) {
    await writeAgentLog({
      source: "WEB",
      toolCalled: "web:log-activity",
      actionType: "write.activity_log",
      requestSummary: `Log ${parsed.data.type} con company ${parsed.data.companyId}.`,
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
        message: error?.message ?? "Error registrando actividad.",
      },
    };
  }

  const agentLogId = await writeAgentLog({
    source: "WEB",
    toolCalled: "web:log-activity",
    actionType: "write.activity_log",
    requestSummary: `Log ${parsed.data.type} desde web con company ${parsed.data.companyId}.`,
    responseSummary: `Activity ${data.id} creada.`,
    entitiesAffected: [
      { table: "activities", id: data.id },
      { table: "companies", id: parsed.data.companyId },
    ],
    status: "SUCCESS",
    durationMs,
    requestedByUserId: user.id,
  });

  revalidatePath("/activity");
  revalidatePath("/dashboard");
  revalidatePath(`/companies/${parsed.data.companyId}`);
  if (parsed.data.projectId)
    revalidatePath(`/projects/${parsed.data.projectId}`);
  return { ok: true, data: { id: data.id }, agent_log_id: agentLogId };
}
