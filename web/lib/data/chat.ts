import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type ChatChannelListItem = {
  id: string;
  kind: "DIRECT" | "GROUP";
  name: string | null;
  updated_at: string;
  last_read_at: string | null;
  members: { user_id: string; full_name: string }[];
  last_message: {
    body: string;
    created_at: string;
    author_id: string;
    deleted_at: string | null;
  } | null;
  unread_count: number;
};

export type ChatMentionRow = {
  id: string;
  offset: number;
  length: number;
  mentioned_user_id: string | null;
  mentioned_task_id: string | null;
  mentioned_user: { id: string; full_name: string } | null;
  mentioned_task: { id: string; title: string } | null;
};

export type ChatMessageRow = {
  id: string;
  channel_id: string;
  author_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  author: { id: string; full_name: string } | null;
  mentions: ChatMentionRow[];
};

export type ChatChannelDetail = {
  id: string;
  kind: "DIRECT" | "GROUP";
  name: string | null;
  members: { user_id: string; full_name: string }[];
};

export async function listChatChannelsForUser(
  userId: string,
): Promise<ChatChannelListItem[]> {
  const supa = createServiceRoleClient();
  const { data: memberships } = await supa
    .from("chat_channel_members")
    .select(
      "channel_id, last_read_at, channel:chat_channels!inner(id, kind, name, updated_at)",
    )
    .eq("user_id", userId);

  const rows = (memberships ?? []) as unknown as {
    channel_id: string;
    last_read_at: string | null;
    channel: {
      id: string;
      kind: "DIRECT" | "GROUP";
      name: string | null;
      updated_at: string;
    };
  }[];

  if (rows.length === 0) return [];

  const channelIds = rows.map((r) => r.channel_id);

  const { data: allMembers } = await supa
    .from("chat_channel_members")
    .select("channel_id, user_id, user:users(id, full_name)")
    .in("channel_id", channelIds);

  const membersByChannel = new Map<
    string,
    { user_id: string; full_name: string }[]
  >();
  for (const m of (allMembers ?? []) as unknown as {
    channel_id: string;
    user_id: string;
    user: { full_name: string } | null;
  }[]) {
    const arr = membersByChannel.get(m.channel_id) ?? [];
    arr.push({
      user_id: m.user_id,
      full_name: m.user?.full_name ?? "—",
    });
    membersByChannel.set(m.channel_id, arr);
  }

  const items: ChatChannelListItem[] = [];
  for (const r of rows) {
    const { data: last } = await supa
      .from("chat_messages")
      .select("body, created_at, author_id, deleted_at")
      .eq("channel_id", r.channel_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let unread = 0;
    if (r.last_read_at) {
      const { count } = await supa
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("channel_id", r.channel_id)
        .gt("created_at", r.last_read_at)
        .neq("author_id", userId);
      unread = count ?? 0;
    } else {
      const { count } = await supa
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("channel_id", r.channel_id)
        .neq("author_id", userId);
      unread = count ?? 0;
    }

    items.push({
      id: r.channel.id,
      kind: r.channel.kind,
      name: r.channel.name,
      updated_at: r.channel.updated_at,
      last_read_at: r.last_read_at,
      members: membersByChannel.get(r.channel_id) ?? [],
      last_message: last
        ? {
            body: last.body,
            created_at: last.created_at,
            author_id: last.author_id,
            deleted_at: last.deleted_at,
          }
        : null,
      unread_count: unread,
    });
  }

  items.sort(
    (a, b) =>
      new Date(b.last_message?.created_at ?? b.updated_at).getTime() -
      new Date(a.last_message?.created_at ?? a.updated_at).getTime(),
  );

  return items;
}

export async function getChatChannel(
  channelId: string,
  userId: string,
): Promise<ChatChannelDetail | null> {
  const supa = createServiceRoleClient();
  const { data: channel } = await supa
    .from("chat_channels")
    .select("id, kind, name")
    .eq("id", channelId)
    .maybeSingle();
  if (!channel) return null;

  const { data: members } = await supa
    .from("chat_channel_members")
    .select("user_id, user:users(id, full_name)")
    .eq("channel_id", channelId);

  const rows = (members ?? []) as unknown as {
    user_id: string;
    user: { full_name: string } | null;
  }[];
  const isMember = rows.some((m) => m.user_id === userId);
  if (!isMember) return null;

  return {
    id: channel.id,
    kind: channel.kind as "DIRECT" | "GROUP",
    name: channel.name,
    members: rows.map((m) => ({
      user_id: m.user_id,
      full_name: m.user?.full_name ?? "—",
    })),
  };
}

export async function getChatMessages(
  channelId: string,
  limit = 100,
): Promise<ChatMessageRow[]> {
  const supa = createServiceRoleClient();
  const { data } = await supa
    .from("chat_messages")
    .select(
      "id, channel_id, author_id, body, created_at, edited_at, deleted_at, author:users(id, full_name), mentions:chat_mentions(id, offset, length, mentioned_user_id, mentioned_task_id, mentioned_user:users!chat_mentions_mentioned_user_id_fkey(id, full_name), mentioned_task:tasks!chat_mentions_mentioned_task_id_fkey(id, title))",
    )
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as unknown as ChatMessageRow[]).reverse();
}
