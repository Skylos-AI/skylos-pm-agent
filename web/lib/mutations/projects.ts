"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth/current-user";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { writeAgentLog } from "@/lib/mutations/log";

const SERVICES = [
  "AI_AUDIT",
  "AUTOMATION",
  "CUSTOM_SOFTWARE",
  "BLOCKCHAIN_WEB3",
  "TRAINING",
  "RETAINER",
] as const;

const schema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1, "El nombre es obligatorio."),
  serviceType: z.enum(SERVICES),
  valueBob: z.number().nonnegative().optional(),
  targetEndDate: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

type Envelope<T> =
  | { ok: true; data: T; agent_log_id: string | null }
  | { ok: false; error: { code: string; message: string } };

export async function createProject(
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
    .from("projects")
    .insert({
      company_id: parsed.data.companyId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      service_type: parsed.data.serviceType,
      owner_id: user.id,
      status: "ACTIVE",
      start_date: new Date().toISOString().slice(0, 10),
      target_end_date: parsed.data.targetEndDate ?? null,
      value_bob:
        typeof parsed.data.valueBob === "number"
          ? parsed.data.valueBob.toFixed(2)
          : null,
    })
    .select("id")
    .single();

  const durationMs = Date.now() - startedAt;
  if (error || !data) {
    await writeAgentLog({
      source: "WEB",
      toolCalled: "web:create-project",
      actionType: "write.project_create",
      requestSummary: `Crear proyecto "${parsed.data.name}" para company ${parsed.data.companyId}.`,
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
        message: error?.message ?? "Error creando proyecto.",
      },
    };
  }

  const agentLogId = await writeAgentLog({
    source: "WEB",
    toolCalled: "web:create-project",
    actionType: "write.project_create",
    requestSummary: `Crear proyecto "${parsed.data.name}" desde web.`,
    responseSummary: `Proyecto ${data.id} creado.`,
    entitiesAffected: [
      { table: "projects", id: data.id },
      { table: "companies", id: parsed.data.companyId },
    ],
    status: "SUCCESS",
    durationMs,
    requestedByUserId: user.id,
  });

  revalidatePath(`/companies/${parsed.data.companyId}`);
  revalidatePath("/projects");
  return { ok: true, data: { id: data.id }, agent_log_id: agentLogId };
}
