"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth/current-user";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { writeAgentLog } from "@/lib/mutations/log";

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("591")) return `+${digits}`;
  if (digits.length === 7 || digits.length === 8) return `+591${digits}`;
  return `+${digits}`;
}

const STATUSES = [
  "LEAD",
  "PROSPECT",
  "ACTIVE_CLIENT",
  "PAST_CLIENT",
  "DISQUALIFIED",
] as const;

const PREFERRED_CHANNELS = [
  "WHATSAPP",
  "PHONE",
  "EMAIL",
  "IN_PERSON",
  "MIXED",
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

const preferredChannelSchema = z.object({
  id: z.string().uuid(),
  preferredChannel: z.enum(PREFERRED_CHANNELS).nullable(),
});

export async function updateCompanyPreferredChannel(
  input: z.infer<typeof preferredChannelSchema>,
): Promise<Envelope<{ id: string }>> {
  const parsed = preferredChannelSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: { code: "INVALID_ARGS", message: parsed.error.issues[0]?.message ?? "Datos inválidos." },
    };
  const user = await currentUser();
  if (!user) return { ok: false, error: { code: "NOT_AUTH", message: "No autenticado." } };

  const supa = createServiceRoleClient();
  const startedAt = Date.now();
  const { data, error } = await supa
    .from("companies")
    .update({ preferred_channel: parsed.data.preferredChannel })
    .eq("id", parsed.data.id)
    .select("id")
    .single();
  const durationMs = Date.now() - startedAt;
  if (error || !data)
    return { ok: false, error: { code: "DB_ERROR", message: error?.message ?? "Error." } };

  const agentLogId = await writeAgentLog({
    source: "WEB",
    toolCalled: "web:update-company-preferred-channel",
    actionType: "write.company_preferred_channel",
    requestSummary: `Set preferred_channel=${parsed.data.preferredChannel ?? "null"} on company ${parsed.data.id}.`,
    responseSummary: `OK.`,
    entitiesAffected: [{ table: "companies", id: data.id }],
    status: "SUCCESS",
    durationMs,
    requestedByUserId: user.id,
  });

  revalidatePath("/companies");
  revalidatePath(`/companies/${data.id}`);
  revalidatePath("/outreach");
  return { ok: true, data: { id: data.id }, agent_log_id: agentLogId };
}

const nextTouchSchema = z.object({
  id: z.string().uuid(),
  nextTouchAt: z.string().nullable(),
});

export async function updateCompanyNextTouch(
  input: z.infer<typeof nextTouchSchema>,
): Promise<Envelope<{ id: string }>> {
  const parsed = nextTouchSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: { code: "INVALID_ARGS", message: parsed.error.issues[0]?.message ?? "Datos inválidos." },
    };
  const user = await currentUser();
  if (!user) return { ok: false, error: { code: "NOT_AUTH", message: "No autenticado." } };

  const supa = createServiceRoleClient();
  const startedAt = Date.now();
  const { data, error } = await supa
    .from("companies")
    .update({ next_touch_at: parsed.data.nextTouchAt })
    .eq("id", parsed.data.id)
    .select("id")
    .single();
  const durationMs = Date.now() - startedAt;
  if (error || !data)
    return { ok: false, error: { code: "DB_ERROR", message: error?.message ?? "Error." } };

  const agentLogId = await writeAgentLog({
    source: "WEB",
    toolCalled: "web:update-company-next-touch",
    actionType: "write.company_next_touch",
    requestSummary: `Set next_touch_at=${parsed.data.nextTouchAt ?? "null"} on company ${parsed.data.id}.`,
    responseSummary: `OK.`,
    entitiesAffected: [{ table: "companies", id: data.id }],
    status: "SUCCESS",
    durationMs,
    requestedByUserId: user.id,
  });

  revalidatePath("/companies");
  revalidatePath(`/companies/${data.id}`);
  revalidatePath("/outreach");
  return { ok: true, data: { id: data.id }, agent_log_id: agentLogId };
}

// Manual lead creation from /companies. Bare minimum: name + at least one
// contact channel. New lead starts as LEAD/MANUAL with no queued outreach
// (next_action_at=NULL) so the automation cron won't touch it — the user
// decides when to reach out.
const createLeadSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio."),
    phone: z
      .string()
      .trim()
      .max(40, "Teléfono demasiado largo.")
      .optional()
      .transform((v) => (v ? v : undefined)),
    email: z
      .string()
      .trim()
      .max(200, "Email demasiado largo.")
      .email("Email inválido.")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    city: z
      .string()
      .trim()
      .max(80)
      .optional()
      .transform((v) => (v ? v : undefined)),
  })
  .refine((v) => Boolean(v.phone) || Boolean(v.email), {
    message: "Ingresá al menos un teléfono o un email.",
    path: ["phone"],
  });

export async function createCompanyLead(
  input: z.infer<typeof createLeadSchema>,
): Promise<Envelope<{ id: string }>> {
  const parsed = createLeadSchema.safeParse(input);
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

  const supa = createServiceRoleClient();
  const startedAt = Date.now();
  const phone = normalizePhone(parsed.data.phone);
  const email = parsed.data.email ?? null;

  const { data: company, error: cErr } = await supa
    .from("companies")
    .insert({
      name: parsed.data.name,
      city: parsed.data.city ?? null,
      source: "MANUAL",
      status: "LEAD",
      sequence_position: 0,
      assigned_to_id: user.id,
    })
    .select("id")
    .single();

  if (cErr || !company) {
    await writeAgentLog({
      source: "WEB",
      toolCalled: "web:create-company-lead",
      actionType: "write.company_create",
      requestSummary: `Crear lead manual "${parsed.data.name}".`,
      responseSummary: cErr?.message ?? "Error",
      status: "ERROR",
      errorMessage: cErr?.message ?? null,
      durationMs: Date.now() - startedAt,
      requestedByUserId: user.id,
    });
    return {
      ok: false,
      error: {
        code: "DB_ERROR",
        message: cErr?.message ?? "Error creando el lead.",
      },
    };
  }

  if (phone || email) {
    const { error: contactErr } = await supa.from("contacts").insert({
      company_id: company.id,
      full_name: "Contacto principal",
      phone,
      whatsapp: phone,
      email,
      is_primary: true,
    });
    if (contactErr) {
      // Company created, contact failed — log a PARTIAL but still return ok
      // so the user isn't stuck; they can edit the contact from the detail page.
      await writeAgentLog({
        source: "WEB",
        toolCalled: "web:create-company-lead",
        actionType: "write.company_create",
        requestSummary: `Lead "${parsed.data.name}" creado pero falló contacto primario.`,
        responseSummary: contactErr.message,
        entitiesAffected: [{ table: "companies", id: company.id }],
        status: "PARTIAL",
        errorMessage: contactErr.message,
        durationMs: Date.now() - startedAt,
        requestedByUserId: user.id,
      });
    }
  }

  const agentLogId = await writeAgentLog({
    source: "WEB",
    toolCalled: "web:create-company-lead",
    actionType: "write.company_create",
    requestSummary: `Nuevo lead manual: ${parsed.data.name}${parsed.data.city ? ` (${parsed.data.city})` : ""}.`,
    responseSummary: `OK. company_id=${company.id}.`,
    entitiesAffected: [{ table: "companies", id: company.id }],
    status: "SUCCESS",
    durationMs: Date.now() - startedAt,
    requestedByUserId: user.id,
  });

  revalidatePath("/companies");
  return { ok: true, data: { id: company.id }, agent_log_id: agentLogId };
}

// Free-form tags on a company. Size tags (size:small|medium|big) are
// mutually exclusive — setting one drops the others so a company can't be
// marked two sizes at once.
const SIZE_TAGS = ["size:small", "size:medium", "size:big"] as const;
const tagRe = /^[a-z0-9][a-z0-9:_\-]{0,39}$|^[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9 &./()-]{0,39}$/;

const tagsSchema = z.object({
  id: z.string().uuid(),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Etiqueta vacía.")
        .max(40, "Etiqueta demasiado larga.")
        .regex(tagRe, "Formato de etiqueta inválido."),
    )
    .max(40, "Demasiadas etiquetas."),
});

export async function updateCompanyTags(
  input: z.infer<typeof tagsSchema>,
): Promise<Envelope<{ id: string; tags: string[] }>> {
  const parsed = tagsSchema.safeParse(input);
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

  // Dedupe (case-sensitive) and enforce one size tag max — last one wins.
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const t of parsed.data.tags) {
    if (seen.has(t)) continue;
    seen.add(t);
    deduped.push(t);
  }
  const sizes = deduped.filter((t) => (SIZE_TAGS as readonly string[]).includes(t));
  const finalTags =
    sizes.length > 1
      ? [
          ...deduped.filter((t) => !(SIZE_TAGS as readonly string[]).includes(t)),
          sizes[sizes.length - 1],
        ]
      : deduped;

  const supa = createServiceRoleClient();
  const startedAt = Date.now();
  const { data: existing } = await supa
    .from("companies")
    .select("id, name, tags")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!existing)
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Empresa no encontrada." },
    };

  const { data, error } = await supa
    .from("companies")
    .update({ tags: finalTags })
    .eq("id", parsed.data.id)
    .select("id, tags")
    .single();

  const durationMs = Date.now() - startedAt;
  if (error || !data) {
    await writeAgentLog({
      source: "WEB",
      toolCalled: "web:update-company-tags",
      actionType: "write.company_tags",
      requestSummary: `Actualizar etiquetas de ${existing.name}.`,
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
        message: error?.message ?? "Error actualizando etiquetas.",
      },
    };
  }

  const prev = ((existing.tags ?? []) as string[]) || [];
  const added = finalTags.filter((t) => !prev.includes(t));
  const removed = prev.filter((t) => !finalTags.includes(t));

  const agentLogId = await writeAgentLog({
    source: "WEB",
    toolCalled: "web:update-company-tags",
    actionType: "write.company_tags",
    requestSummary: `Etiquetas ${existing.name}: +[${added.join(", ")}] -[${removed.join(", ")}].`,
    responseSummary: `OK. tags=${(data.tags as string[]).length}.`,
    entitiesAffected: [{ table: "companies", id: data.id }],
    status: "SUCCESS",
    durationMs,
    requestedByUserId: user.id,
  });

  revalidatePath("/companies");
  revalidatePath(`/companies/${data.id}`);
  return {
    ok: true,
    data: { id: data.id, tags: data.tags as string[] },
    agent_log_id: agentLogId,
  };
}
