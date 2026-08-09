"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth/current-user";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { writeAgentLog } from "@/lib/mutations/log";

type Envelope<T> =
  | { ok: true; data: T; agent_log_id: string | null }
  | { ok: false; error: { code: string; message: string } };

const createChannelSchema = z
  .object({
    kind: z.enum(["DIRECT", "GROUP"]),
    name: z.string().trim().min(1).max(80).optional(),
    memberIds: z.array(z.string().uuid()).min(1).max(20),
  })
  .refine((d) => d.kind === "DIRECT" || (d.name && d.name.length > 0), {
    message: "Los canales grupales requieren un nombre.",
    path: ["name"],
  })
  .refine((d) => d.kind === "GROUP" || d.memberIds.length === 1, {
    message: "Un DM debe tener exactamente un miembro adicional.",
    path: ["memberIds"],
  });

export async function createChatChannel(
  input: z.infer<typeof createChannelSchema>,
): Promise<Envelope<{ id: string }>> {
  const parsed = createChannelSchema.safeParse(input);
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

  const memberIds = Array.from(
    new Set([user.id, ...parsed.data.memberIds]),
  );

  if (parsed.data.kind === "DIRECT") {
    if (memberIds.length !== 2) {
      return {
        ok: false,
        error: { code: "INVALID_ARGS", message: "DM requiere dos usuarios." },
      };
    }
    const { data: candidates } = await supa
      .from("chat_channel_members")
      .select("channel_id, chat_channels!inner(kind)")
      .eq("user_id", user.id);
    const otherId = memberIds.find((id) => id !== user.id)!;
    let existingId: string | null = null;
    for (const c of candidates ?? []) {
      const ch = c as unknown as {
        channel_id: string;
        chat_channels: { kind: string };
      };
      if (ch.chat_channels.kind !== "DIRECT") continue;
      const { data: peers } = await supa
        .from("chat_channel_members")
        .select("user_id")
        .eq("channel_id", ch.channel_id);
      const ids = (peers ?? []).map((p) => p.user_id).sort();
      if (ids.length === 2 && ids.includes(otherId)) {
        existingId = ch.channel_id;
        break;
      }
    }
    if (existingId) {
      return {
        ok: true,
        data: { id: existingId },
        agent_log_id: null,
      };
    }
  }

  const { data: channel, error: chanErr } = await supa
    .from("chat_channels")
    .insert({
      kind: parsed.data.kind,
      name: parsed.data.name ?? null,
      created_by_id: user.id,
    })
    .select("id")
    .single();

  if (chanErr || !channel) {
    return {
      ok: false,
      error: {
        code: "DB_ERROR",
        message: chanErr?.message ?? "Error creando canal.",
      },
    };
  }

  const { error: memErr } = await supa.from("chat_channel_members").insert(
    memberIds.map((id) => ({
      channel_id: channel.id,
      user_id: id,
    })),
  );

  if (memErr) {
    await supa.from("chat_channels").delete().eq("id", channel.id);
    return {
      ok: false,
      error: { code: "DB_ERROR", message: memErr.message },
    };
  }

  const durationMs = Date.now() - startedAt;
  const agentLogId = await writeAgentLog({
    source: "WEB",
    toolCalled: "web:create-chat-channel",
    actionType: "write.chat_channel_create",
    requestSummary: `Canal ${parsed.data.kind}${
      parsed.data.name ? ` "${parsed.data.name}"` : ""
    } con ${memberIds.length} miembros.`,
    responseSummary: `Canal ${channel.id} creado.`,
    entitiesAffected: [{ table: "chat_channels", id: channel.id }],
    status: "SUCCESS",
    durationMs,
    requestedByUserId: user.id,
  });

  revalidatePath("/chat");
  return { ok: true, data: { id: channel.id }, agent_log_id: agentLogId };
}

const sendMessageSchema = z.object({
  channelId: z.string().uuid(),
  body: z
    .string()
    .trim()
    .min(1, "El mensaje no puede estar vacío.")
    .max(4000, "El mensaje no puede superar 4000 caracteres."),
});

export async function sendChatMessage(
  input: z.infer<typeof sendMessageSchema>,
): Promise<Envelope<{ id: string }>> {
  const parsed = sendMessageSchema.safeParse(input);
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

  const { data: member } = await supa
    .from("chat_channel_members")
    .select("user_id")
    .eq("channel_id", parsed.data.channelId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) {
    return {
      ok: false,
      error: { code: "FORBIDDEN", message: "No sos miembro de este canal." },
    };
  }

  const { data, error } = await supa
    .from("chat_messages")
    .insert({
      channel_id: parsed.data.channelId,
      author_id: user.id,
      body: parsed.data.body,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: {
        code: "DB_ERROR",
        message: error?.message ?? "Error enviando mensaje.",
      },
    };
  }

  await supa
    .from("chat_channels")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", parsed.data.channelId);

  await supa
    .from("chat_channel_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("channel_id", parsed.data.channelId)
    .eq("user_id", user.id);

  revalidatePath(`/chat/${parsed.data.channelId}`);
  return { ok: true, data: { id: data.id }, agent_log_id: null };
}

const editMessageSchema = z.object({
  id: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});

export async function editChatMessage(
  input: z.infer<typeof editMessageSchema>,
): Promise<Envelope<{ id: string }>> {
  const parsed = editMessageSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: { code: "INVALID_ARGS", message: "Datos inválidos." },
    };

  const user = await currentUser();
  if (!user)
    return { ok: false, error: { code: "NOT_AUTH", message: "No autenticado." } };

  const supa = createServiceRoleClient();
  const { data: msg } = await supa
    .from("chat_messages")
    .select("id, author_id, channel_id, deleted_at")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!msg)
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Mensaje no encontrado." },
    };
  if (msg.deleted_at)
    return {
      ok: false,
      error: { code: "GONE", message: "El mensaje fue eliminado." },
    };
  if (msg.author_id !== user.id)
    return {
      ok: false,
      error: { code: "FORBIDDEN", message: "Solo el autor puede editar." },
    };

  const { error } = await supa
    .from("chat_messages")
    .update({ body: parsed.data.body, edited_at: new Date().toISOString() })
    .eq("id", parsed.data.id);
  if (error)
    return { ok: false, error: { code: "DB_ERROR", message: error.message } };

  revalidatePath(`/chat/${msg.channel_id}`);
  return { ok: true, data: { id: parsed.data.id }, agent_log_id: null };
}

const deleteMessageSchema = z.object({ id: z.string().uuid() });

export async function deleteChatMessage(
  input: z.infer<typeof deleteMessageSchema>,
): Promise<Envelope<{ id: string }>> {
  const parsed = deleteMessageSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: { code: "INVALID_ARGS", message: "Datos inválidos." },
    };
  const user = await currentUser();
  if (!user)
    return { ok: false, error: { code: "NOT_AUTH", message: "No autenticado." } };

  const supa = createServiceRoleClient();
  const { data: msg } = await supa
    .from("chat_messages")
    .select("id, author_id, channel_id")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!msg)
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Mensaje no encontrado." },
    };
  if (msg.author_id !== user.id)
    return {
      ok: false,
      error: { code: "FORBIDDEN", message: "Solo el autor puede borrar." },
    };

  const { error } = await supa
    .from("chat_messages")
    .update({ deleted_at: new Date().toISOString(), body: "" })
    .eq("id", parsed.data.id);
  if (error)
    return { ok: false, error: { code: "DB_ERROR", message: error.message } };

  revalidatePath(`/chat/${msg.channel_id}`);
  return { ok: true, data: { id: parsed.data.id }, agent_log_id: null };
}

const markReadSchema = z.object({ channelId: z.string().uuid() });

export async function markChatChannelRead(
  input: z.infer<typeof markReadSchema>,
): Promise<Envelope<{ channelId: string }>> {
  const parsed = markReadSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: { code: "INVALID_ARGS", message: "Datos inválidos." },
    };
  const user = await currentUser();
  if (!user)
    return { ok: false, error: { code: "NOT_AUTH", message: "No autenticado." } };

  const supa = createServiceRoleClient();
  const { error } = await supa
    .from("chat_channel_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("channel_id", parsed.data.channelId)
    .eq("user_id", user.id);
  if (error)
    return { ok: false, error: { code: "DB_ERROR", message: error.message } };

  return {
    ok: true,
    data: { channelId: parsed.data.channelId },
    agent_log_id: null,
  };
}
