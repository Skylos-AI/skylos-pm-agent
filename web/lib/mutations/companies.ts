"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth/current-user";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { writeAgentLog } from "@/lib/mutations/log";

const STATUSES = [
  "LEAD",
  "PROSPECT",
  "ACTIVE_CLIENT",
  "PAST_CLIENT",
  "DISQUALIFIED",
] as const;

const schema = z.object({
  id: z.string().uuid(),
  status: z.enum(STATUSES),
});

type Envelope<T> =
  | { ok: true; data: T; agent_log_id: string | null }
  | { ok: false; error: { code: string; message: string } };

export async function updateCompanyStatus(
  input: z.infer<typeof schema>,
): Promise<Envelope<{ id: string; status: string }>> {
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

  const { data: existing } = await supa
    .from("companies")
    .select("id, name, status")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!existing)
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Empresa no encontrada." },
    };

  const { data, error } = await supa
    .from("companies")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .select("id, status")
    .single();

  const durationMs = Date.now() - startedAt;
  if (error || !data) {
    await writeAgentLog({
      source: "WEB",
      toolCalled: "web:update-company-status",
      actionType: "write.company_status_update",
      requestSummary: `Cambiar estado de ${existing.name} a ${parsed.data.status}.`,
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
        message: error?.message ?? "Error actualizando estado.",
      },
    };
  }

  const agentLogId = await writeAgentLog({
    source: "WEB",
    toolCalled: "web:update-company-status",
    actionType: "write.company_status_update",
    requestSummary: `${existing.name}: ${existing.status} → ${parsed.data.status}.`,
    responseSummary: `OK. status=${data.status}.`,
    entitiesAffected: [{ table: "companies", id: data.id }],
    status: "SUCCESS",
    durationMs,
    requestedByUserId: user.id,
  });

  revalidatePath("/companies");
  revalidatePath(`/companies/${data.id}`);
  return {
    ok: true,
    data: { id: data.id, status: data.status },
    agent_log_id: agentLogId,
  };
}
