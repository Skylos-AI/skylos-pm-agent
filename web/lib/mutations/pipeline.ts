"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth/current-user";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { writeAgentLog } from "@/lib/mutations/log";

const STAGES = [
  "LEAD",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;

const schema = z
  .object({
    id: z.string().uuid("ID inválido"),
    stage: z.enum(STAGES).optional(),
    valueBob: z.number().nonnegative().optional(),
    probability: z.number().int().min(0).max(100).optional(),
    expectedCloseDate: z.string().optional(),
    lostReason: z.string().min(1).optional(),
  })
  .refine(
    (d) => d.stage !== "LOST" || (d.lostReason && d.lostReason.length > 0),
    { message: "Para mover a LOST debes enviar lostReason.", path: ["lostReason"] },
  );

export type Envelope<T> =
  | { ok: true; data: T; agent_log_id: string | null }
  | { ok: false; error: { code: string; message: string } };

export async function updatePipelineDeal(
  input: z.infer<typeof schema>,
): Promise<Envelope<{ id: string; stage: string }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "INVALID_ARGS",
        message: parsed.error.issues[0]?.message ?? "Argumentos inválidos.",
      },
    };
  }
  const user = await currentUser();
  if (!user)
    return { ok: false, error: { code: "NOT_AUTH", message: "No autenticado." } };

  const supa = createServiceRoleClient();
  const startedAt = Date.now();

  const { data: existing, error: existingErr } = await supa
    .from("pipeline_deals")
    .select("id, title, stage")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (existingErr || !existing) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Negocio no encontrado." },
    };
  }

  const update: Record<string, string | number | null> = {};
  if (parsed.data.stage) {
    update.stage = parsed.data.stage;
    if (parsed.data.stage === "WON")
      update.actual_close_date = new Date().toISOString().slice(0, 10);
    if (parsed.data.stage === "LOST") {
      update.actual_close_date = new Date().toISOString().slice(0, 10);
      update.lost_reason = parsed.data.lostReason ?? null;
    }
  }
  if (typeof parsed.data.valueBob === "number")
    update.value_bob = parsed.data.valueBob.toFixed(2);
  if (typeof parsed.data.probability === "number")
    update.probability = parsed.data.probability;
  if (parsed.data.expectedCloseDate)
    update.expected_close_date = parsed.data.expectedCloseDate;

  const { data, error } = await supa
    .from("pipeline_deals")
    .update(update)
    .eq("id", parsed.data.id)
    .select("id, stage")
    .single();

  const durationMs = Date.now() - startedAt;
  if (error || !data) {
    await writeAgentLog({
      source: "WEB",
      toolCalled: "web:update-pipeline-deal",
      actionType: "write.deal_update",
      requestSummary: `Actualizar negocio ${existing.title} desde web.`,
      responseSummary: error?.message ?? "Error sin mensaje",
      status: "ERROR",
      errorMessage: error?.message ?? null,
      durationMs,
      requestedByUserId: user.id,
    });
    return {
      ok: false,
      error: {
        code: "DB_ERROR",
        message: error?.message ?? "Error actualizando negocio.",
      },
    };
  }

  const agentLogId = await writeAgentLog({
    source: "WEB",
    toolCalled: "web:update-pipeline-deal",
    actionType: "write.deal_update",
    requestSummary: `Negocio "${existing.title}"${
      parsed.data.stage ? ` movido de ${existing.stage} a ${parsed.data.stage}` : " actualizado"
    } desde web.`,
    responseSummary: `OK. Negocio ${data.id} en stage ${data.stage}.`,
    entitiesAffected: [{ table: "pipeline_deals", id: data.id }],
    status: "SUCCESS",
    durationMs,
    requestedByUserId: user.id,
  });

  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  return {
    ok: true,
    data: { id: data.id, stage: data.stage },
    agent_log_id: agentLogId,
  };
}

const createSchema = z.object({
  companyId: z.string().uuid(),
  title: z.string().min(1, "El título es obligatorio."),
  stage: z.enum(STAGES).default("LEAD"),
  valueBob: z.number().nonnegative().optional(),
  probability: z.number().int().min(0).max(100).optional(),
  expectedCloseDate: z.string().optional(),
  ownerId: z.string().uuid().optional(),
});

export async function createPipelineDeal(
  input: z.infer<typeof createSchema>,
): Promise<Envelope<{ id: string; stage: string }>> {
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

  const { data: company } = await supa
    .from("companies")
    .select("id, name")
    .eq("id", parsed.data.companyId)
    .maybeSingle();
  if (!company)
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Empresa no encontrada." },
    };

  const insert: Record<string, string | number | null> = {
    company_id: parsed.data.companyId,
    title: parsed.data.title,
    stage: parsed.data.stage,
    owner_id: parsed.data.ownerId ?? user.id,
  };
  if (typeof parsed.data.valueBob === "number")
    insert.value_bob = parsed.data.valueBob.toFixed(2);
  if (typeof parsed.data.probability === "number")
    insert.probability = parsed.data.probability;
  if (parsed.data.expectedCloseDate)
    insert.expected_close_date = parsed.data.expectedCloseDate;

  const { data, error } = await supa
    .from("pipeline_deals")
    .insert(insert)
    .select("id, stage")
    .single();

  const durationMs = Date.now() - startedAt;
  if (error || !data) {
    await writeAgentLog({
      source: "WEB",
      toolCalled: "web:create-pipeline-deal",
      actionType: "write.deal_create",
      requestSummary: `Crear negocio "${parsed.data.title}" para ${company.name}.`,
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
        message: error?.message ?? "Error creando negocio.",
      },
    };
  }

  const agentLogId = await writeAgentLog({
    source: "WEB",
    toolCalled: "web:create-pipeline-deal",
    actionType: "write.deal_create",
    requestSummary: `Crear negocio "${parsed.data.title}" para ${company.name} en ${parsed.data.stage} desde web.`,
    responseSummary: `Negocio ${data.id} creado en stage ${data.stage}.`,
    entitiesAffected: [
      { table: "pipeline_deals", id: data.id },
      { table: "companies", id: parsed.data.companyId },
    ],
    status: "SUCCESS",
    durationMs,
    requestedByUserId: user.id,
  });

  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  revalidatePath(`/companies/${parsed.data.companyId}`);
  return {
    ok: true,
    data: { id: data.id, stage: data.stage },
    agent_log_id: agentLogId,
  };
}
