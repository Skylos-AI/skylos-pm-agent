"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth/current-user";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { writeAgentLog } from "@/lib/mutations/log";

const KINDS = [
  "PROPOSAL",
  "DECK",
  "ONE_PAGER",
  "EMAIL_TEMPLATE",
  "BROCHURE",
  "CASE_STUDY",
  "CONTRACT",
  "OTHER",
] as const;

type Envelope<T> =
  | { ok: true; data: T; agent_log_id: string | null }
  | { ok: false; error: { code: string; message: string } };

const createSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio."),
  kind: z.enum(KINDS),
  externalUrl: z.string().url().nullable().optional(),
  version: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function createAsset(
  input: z.infer<typeof createSchema>,
): Promise<Envelope<{ id: string }>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: {
        code: "INVALID_ARGS",
        message: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      },
    };
  const user = await currentUser();
  if (!user) return { ok: false, error: { code: "NOT_AUTH", message: "No autenticado." } };

  const supa = createServiceRoleClient();
  const startedAt = Date.now();
  const { data, error } = await supa
    .from("assets")
    .insert({
      name: parsed.data.name,
      kind: parsed.data.kind,
      external_url: parsed.data.externalUrl ?? null,
      version: parsed.data.version ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();
  const durationMs = Date.now() - startedAt;
  if (error || !data)
    return { ok: false, error: { code: "DB_ERROR", message: error?.message ?? "Error." } };

  const agentLogId = await writeAgentLog({
    source: "WEB",
    toolCalled: "web:create-asset",
    actionType: "write.asset_create",
    requestSummary: `Registrar asset "${parsed.data.name}" (${parsed.data.kind}).`,
    responseSummary: `Asset ${data.id} creado.`,
    entitiesAffected: [{ table: "assets", id: data.id }],
    status: "SUCCESS",
    durationMs,
    requestedByUserId: user.id,
  });

  revalidatePath("/assets");
  return { ok: true, data: { id: data.id }, agent_log_id: agentLogId };
}

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  kind: z.enum(KINDS).optional(),
  externalUrl: z.string().url().nullable().optional(),
  version: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export async function updateAsset(
  input: z.infer<typeof updateSchema>,
): Promise<Envelope<{ id: string }>> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: {
        code: "INVALID_ARGS",
        message: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      },
    };
  const user = await currentUser();
  if (!user) return { ok: false, error: { code: "NOT_AUTH", message: "No autenticado." } };

  const update: Record<string, string | boolean | null> = {};
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.kind !== undefined) update.kind = parsed.data.kind;
  if (parsed.data.externalUrl !== undefined) update.external_url = parsed.data.externalUrl;
  if (parsed.data.version !== undefined) update.version = parsed.data.version;
  if (parsed.data.notes !== undefined) update.notes = parsed.data.notes;
  if (parsed.data.active !== undefined) update.active = parsed.data.active;

  const supa = createServiceRoleClient();
  const startedAt = Date.now();
  const { data, error } = await supa
    .from("assets")
    .update(update)
    .eq("id", parsed.data.id)
    .select("id")
    .single();
  const durationMs = Date.now() - startedAt;
  if (error || !data)
    return { ok: false, error: { code: "DB_ERROR", message: error?.message ?? "Error." } };

  const agentLogId = await writeAgentLog({
    source: "WEB",
    toolCalled: "web:update-asset",
    actionType: "write.asset_update",
    requestSummary: `Update asset ${parsed.data.id}: ${JSON.stringify(update)}.`,
    responseSummary: `OK.`,
    entitiesAffected: [{ table: "assets", id: data.id }],
    status: "SUCCESS",
    durationMs,
    requestedByUserId: user.id,
  });

  revalidatePath("/assets");
  return { ok: true, data: { id: data.id }, agent_log_id: agentLogId };
}
