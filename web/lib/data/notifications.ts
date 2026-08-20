import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type NotificationKind =
  | "CHAT_MENTION"
  | "TASK_ASSIGNED"
  | "TASK_REVIEW_REQUESTED"
  | "TASK_APPROVED"
  | "TASK_REJECTED"
  | "TASK_COMPLETED";

export type NotificationRow = {
  id: string;
  kind: NotificationKind;
  body: string;
  source_message_id: string | null;
  source_mention_id: string | null;
  source_task_id: string | null;
  source_user_id: string | null;
  read_at: string | null;
  created_at: string;
  channel_id: string | null;
};

// Recent notifications for a user, unread first then read. We hydrate
// channel_id for chat mentions so the bell can link directly to
// /chat/<channel_id>.
export async function getNotificationsForUser(
  userId: string,
  limit = 30,
): Promise<NotificationRow[]> {
  const supa = createServiceRoleClient();
  const { data } = await supa
    .from("notifications")
    .select(
      "id, kind, body, source_message_id, source_mention_id, source_task_id, source_user_id, read_at, created_at",
    )
    .eq("user_id", userId)
    .order("read_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = (data ?? []) as unknown as Omit<NotificationRow, "channel_id">[];

  const messageIds = rows
    .map((r) => r.source_message_id)
    .filter((x): x is string => Boolean(x));
  const channelByMessage = new Map<string, string>();
  if (messageIds.length > 0) {
    const { data: msgs } = await supa
      .from("chat_messages")
      .select("id, channel_id")
      .in("id", messageIds);
    for (const m of (msgs ?? []) as { id: string; channel_id: string }[]) {
      channelByMessage.set(m.id, m.channel_id);
    }
  }

  return rows.map((r) => ({
    ...r,
    channel_id: r.source_message_id
      ? channelByMessage.get(r.source_message_id) ?? null
      : null,
  }));
}

export async function getUnreadNotificationCount(
  userId: string,
): Promise<number> {
  const supa = createServiceRoleClient();
  const { count } = await supa
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return count ?? 0;
}
