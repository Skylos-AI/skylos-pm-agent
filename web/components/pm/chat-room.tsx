"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import {
  Send,
  Users,
  User,
  Pencil,
  Trash2,
  X,
  Check,
  CheckSquare,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  sendChatMessage,
  editChatMessage,
  deleteChatMessage,
  markChatChannelRead,
} from "@/lib/mutations/chat";
import { formatDateTime } from "@/lib/format/date";
import type { ChatMessageRow, ChatMentionRow } from "@/lib/data/chat";

type Member = { user_id: string; full_name: string };
type MentionUser = { id: string; full_name: string };
type MentionTask = { id: string; title: string; assignee_full_name: string | null };

// A mention the user has just picked from the popover. We track the label
// (starting with "@") so we can locate it in the body at send-time even if
// the user typed more text around it afterwards.
type PendingMention = {
  key: string; // unique per insertion, so duplicate labels stay distinct in state
  label: string; // includes the leading "@"
  userId?: string;
  taskId?: string;
};

// Autocomplete popover state. Anchored to the `@` position in the textarea.
type AutocompleteState = {
  open: boolean;
  query: string;
  triggerIndex: number; // index of the `@` in the body
  highlight: number;
};

const AUTOCOMPLETE_CLOSED: AutocompleteState = {
  open: false,
  query: "",
  triggerIndex: -1,
  highlight: 0,
};

export function ChatRoom({
  channelId,
  channelKind,
  title,
  members,
  currentUserId,
  initialMessages,
  mentionUsers,
  mentionTasks,
}: {
  channelId: string;
  channelKind: "DIRECT" | "GROUP";
  title: string;
  members: Member[];
  currentUserId: string;
  initialMessages: ChatMessageRow[];
  mentionUsers: MentionUser[];
  mentionTasks: MentionTask[];
}) {
  const [messages, setMessages] = useState<ChatMessageRow[]>(initialMessages);
  const [body, setBody] = useState("");
  const [pendingMentions, setPendingMentions] = useState<PendingMention[]>([]);
  const [autocomplete, setAutocomplete] =
    useState<AutocompleteState>(AUTOCOMPLETE_CLOSED);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const memberLookup = useMemo(
    () => new Map(members.map((m) => [m.user_id, m.full_name])),
    [members],
  );

  // Filtered autocomplete suggestions — users first, then tasks. Cap at 8
  // combined so the popover never overflows the composer.
  const suggestions = useMemo(() => {
    const q = autocomplete.query.toLowerCase();
    const users = mentionUsers
      .filter((u) => u.id !== currentUserId)
      .filter((u) => u.full_name.toLowerCase().includes(q))
      .slice(0, 5)
      .map((u) => ({
        kind: "user" as const,
        id: u.id,
        label: u.full_name,
        sublabel: null as string | null,
      }));
    const tasks = mentionTasks
      .filter((t) => t.title.toLowerCase().includes(q))
      .slice(0, 5)
      .map((t) => ({
        kind: "task" as const,
        id: t.id,
        label: t.title,
        sublabel: t.assignee_full_name ?? null,
      }));
    return [...users, ...tasks].slice(0, 8);
  }, [autocomplete.query, mentionUsers, mentionTasks, currentUserId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  useEffect(() => {
    void markChatChannelRead({ channelId });
  }, [channelId, messages.length]);

  useEffect(() => {
    const supa = createClient();
    const channel = supa
      .channel(`chat:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            channel_id: string;
            author_id: string;
            body: string;
            created_at: string;
            edited_at: string | null;
            deleted_at: string | null;
          };
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [
              ...prev,
              {
                ...row,
                author: {
                  id: row.author_id,
                  full_name: memberLookup.get(row.author_id) ?? "—",
                },
                // Mentions arrive via the initial fetch or a page refresh —
                // realtime here only carries the message row itself. Rendering
                // an empty mentions array is fine; the pill just won't appear
                // until the next full load.
                mentions: [],
              },
            ];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const row = payload.new as ChatMessageRow;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === row.id
                ? {
                    ...m,
                    body: row.body,
                    edited_at: row.edited_at,
                    deleted_at: row.deleted_at,
                  }
                : m,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      void supa.removeChannel(channel);
    };
  }, [channelId, memberLookup]);

  function updateAutocompleteForCursor(nextBody: string, cursor: number) {
    // Walk back from the cursor to find an unescaped "@" that starts a token
    // (either the beginning of the body or preceded by whitespace). Break on
    // whitespace — the token ends there.
    let at = -1;
    for (let i = cursor - 1; i >= 0; i--) {
      const ch = nextBody[i];
      if (ch === "@") {
        if (i === 0 || /\s/.test(nextBody[i - 1] ?? "")) {
          at = i;
        }
        break;
      }
      if (/\s/.test(ch ?? "")) break;
    }
    if (at === -1) {
      setAutocomplete(AUTOCOMPLETE_CLOSED);
      return;
    }
    const query = nextBody.slice(at + 1, cursor);
    setAutocomplete({
      open: true,
      query,
      triggerIndex: at,
      highlight: 0,
    });
  }

  function onBodyChange(nextBody: string, cursor: number) {
    setBody(nextBody);
    // Drop any pending mention whose label no longer appears in the body —
    // this covers the case where the user backspaces through a mention.
    setPendingMentions((prev) => prev.filter((m) => nextBody.includes(m.label)));
    updateAutocompleteForCursor(nextBody, cursor);
  }

  function insertMention(sel: (typeof suggestions)[number]) {
    if (!autocomplete.open || autocomplete.triggerIndex < 0) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    const cursor = textarea.selectionStart ?? body.length;
    const before = body.slice(0, autocomplete.triggerIndex);
    const after = body.slice(cursor);
    const label = `@${sel.label}`;
    // Trailing space keeps typing natural after a mention.
    const insertion = `${label} `;
    const nextBody = `${before}${insertion}${after}`;
    setBody(nextBody);
    setPendingMentions((prev) => [
      ...prev,
      {
        key: `${Date.now()}-${sel.kind}-${sel.id}-${prev.length}`,
        label,
        userId: sel.kind === "user" ? sel.id : undefined,
        taskId: sel.kind === "task" ? sel.id : undefined,
      },
    ]);
    setAutocomplete(AUTOCOMPLETE_CLOSED);
    // Restore the cursor just after the inserted mention.
    requestAnimationFrame(() => {
      const pos = before.length + insertion.length;
      textarea.focus();
      textarea.setSelectionRange(pos, pos);
    });
  }

  function send(e?: FormEvent) {
    e?.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || isPending) return;
    setError(null);

    // Resolve pending mentions into offset/length pairs against the final
    // (trimmed) body. Multiple mentions with the same label are resolved in
    // insertion order — indexOf(..., cursor) walks past each match.
    const resolvedMentions: {
      offset: number;
      length: number;
      userId?: string;
      taskId?: string;
    }[] = [];
    let cursor = 0;
    for (const m of pendingMentions) {
      const idx = trimmed.indexOf(m.label, cursor);
      if (idx === -1) continue;
      resolvedMentions.push({
        offset: idx,
        length: m.label.length,
        userId: m.userId,
        taskId: m.taskId,
      });
      cursor = idx + m.label.length;
    }

    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: ChatMessageRow = {
      id: optimisticId,
      channel_id: channelId,
      author_id: currentUserId,
      body: trimmed,
      created_at: new Date().toISOString(),
      edited_at: null,
      deleted_at: null,
      author: {
        id: currentUserId,
        full_name: memberLookup.get(currentUserId) ?? "Vos",
      },
      mentions: resolvedMentions.map((rm, i) => ({
        id: `optimistic-mention-${i}`,
        offset: rm.offset,
        length: rm.length,
        mentioned_user_id: rm.userId ?? null,
        mentioned_task_id: rm.taskId ?? null,
        mentioned_user: rm.userId
          ? {
              id: rm.userId,
              full_name:
                mentionUsers.find((u) => u.id === rm.userId)?.full_name ??
                "—",
            }
          : null,
        mentioned_task: rm.taskId
          ? {
              id: rm.taskId,
              title:
                mentionTasks.find((t) => t.id === rm.taskId)?.title ?? "—",
            }
          : null,
      })),
    };
    setMessages((prev) => [...prev, optimistic]);
    setBody("");
    setPendingMentions([]);
    setAutocomplete(AUTOCOMPLETE_CLOSED);
    startTransition(async () => {
      const res = await sendChatMessage({
        channelId,
        body: trimmed,
        mentions: resolvedMentions,
      });
      if (!res.ok) {
        setError(res.error.message);
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setBody(trimmed);
        return;
      }
      setMessages((prev) => {
        // Race: realtime may have already delivered the real row before this
        // response returned. If we blindly renamed the optimistic entry,
        // both entries would end up with the real ID and appear twice.
        if (prev.some((m) => m.id === res.data.id)) {
          return prev.filter((m) => m.id !== optimisticId);
        }
        return prev.map((m) =>
          m.id === optimisticId ? { ...m, id: res.data.id } : m,
        );
      });
    });
  }

  function onComposerKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (autocomplete.open && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAutocomplete((s) => ({
          ...s,
          highlight: (s.highlight + 1) % suggestions.length,
        }));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setAutocomplete((s) => ({
          ...s,
          highlight:
            (s.highlight - 1 + suggestions.length) % suggestions.length,
        }));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(suggestions[autocomplete.highlight]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setAutocomplete(AUTOCOMPLETE_CLOSED);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function beginEdit(m: ChatMessageRow) {
    setEditingId(m.id);
    setEditBody(m.body);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditBody("");
  }

  function saveEdit(id: string) {
    const trimmed = editBody.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await editChatMessage({ id, body: trimmed });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, body: trimmed, edited_at: new Date().toISOString() }
            : m,
        ),
      );
      cancelEdit();
    });
  }

  function removeMessage(id: string) {
    if (!confirm("¿Borrar este mensaje?")) return;
    startTransition(async () => {
      const res = await deleteChatMessage({ id });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, deleted_at: new Date().toISOString(), body: "" }
            : m,
        ),
      );
    });
  }

  return (
    <>
      <header className="border-b border-[var(--brand-border)] px-6 py-4 flex items-center gap-3">
        {channelKind === "GROUP" ? (
          <Users size={16} className="opacity-60" />
        ) : (
          <User size={16} className="opacity-60" />
        )}
        <div className="min-w-0">
          <h1 className="font-display text-lg tracking-tight truncate">
            {title}
          </h1>
          <p className="text-xs text-[var(--brand-fg-muted)] truncate">
            {members.map((m) => m.full_name).join(" · ")}
          </p>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-4 space-y-3"
      >
        {messages.length === 0 && (
          <p className="text-center text-xs text-[var(--brand-fg-muted)] py-8">
            Aún no hay mensajes. Decí hola.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.author_id === currentUserId;
          const deleted = m.deleted_at != null;
          const isEditing = editingId === m.id;
          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`group max-w-[75%] rounded-2xl px-4 py-2 ${
                  mine
                    ? "bg-[var(--brand-blue)] text-white"
                    : "bg-[var(--brand-fg)]/[0.06] text-[var(--brand-fg)]"
                }`}
              >
                {!mine && (
                  <div className="text-[11px] font-medium mb-0.5 opacity-70">
                    {m.author?.full_name ?? "—"}
                  </div>
                )}
                {deleted ? (
                  <div className="text-sm italic opacity-70">
                    Mensaje eliminado
                  </div>
                ) : isEditing ? (
                  <div className="flex items-end gap-2">
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      className="flex-1 bg-transparent border border-white/40 rounded p-1 text-sm resize-none focus:outline-none"
                      rows={2}
                    />
                    <button
                      type="button"
                      onClick={() => saveEdit(m.id)}
                      className="p-1 opacity-80 hover:opacity-100"
                      title="Guardar"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="p-1 opacity-80 hover:opacity-100"
                      title="Cancelar"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <MessageBody
                    body={m.body}
                    mentions={m.mentions ?? []}
                    mine={mine}
                  />
                )}
                <div
                  className={`mt-1 text-[10px] flex items-center gap-2 ${
                    mine ? "text-white/70" : "text-[var(--brand-fg-muted)]"
                  }`}
                >
                  <span>{formatDateTime(m.created_at)}</span>
                  {m.edited_at && !deleted && <span>(editado)</span>}
                  {mine && !deleted && !isEditing && (
                    <span className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => beginEdit(m)}
                        title="Editar"
                        className="hover:opacity-100"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeMessage(m.id)}
                        title="Borrar"
                        className="hover:opacity-100"
                      >
                        <Trash2 size={11} />
                      </button>
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="px-6 pb-2 text-xs text-red-500">{error}</div>
      )}

      <form
        onSubmit={send}
        className="border-t border-[var(--brand-border)] px-4 py-3 flex items-end gap-2 relative"
      >
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) =>
              onBodyChange(e.target.value, e.target.selectionStart ?? 0)
            }
            onKeyUp={(e) => {
              // Cursor moved via arrow keys — re-check autocomplete context.
              if (
                e.key === "ArrowLeft" ||
                e.key === "ArrowRight" ||
                e.key === "Home" ||
                e.key === "End"
              ) {
                const t = e.currentTarget;
                updateAutocompleteForCursor(
                  t.value,
                  t.selectionStart ?? t.value.length,
                );
              }
            }}
            onKeyDown={onComposerKey}
            onBlur={() => {
              // Give click-selection a chance to fire before we close the popover.
              setTimeout(() => setAutocomplete(AUTOCOMPLETE_CLOSED), 100);
            }}
            placeholder="Escribí un mensaje… (@ para mencionar, Enter para enviar)"
            className="w-full resize-none bg-transparent border border-[var(--brand-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]/30 max-h-40"
            rows={2}
          />
          {autocomplete.open && suggestions.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 w-full max-w-sm z-10 bg-[var(--brand-bg)] border border-[var(--brand-border)] rounded-lg shadow-lg overflow-hidden">
              {suggestions.map((s, i) => (
                <button
                  key={`${s.kind}-${s.id}`}
                  type="button"
                  onMouseDown={(e) => {
                    // onMouseDown fires before onBlur → keeps focus on textarea.
                    e.preventDefault();
                    insertMention(s);
                  }}
                  onMouseEnter={() =>
                    setAutocomplete((prev) => ({ ...prev, highlight: i }))
                  }
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                    i === autocomplete.highlight
                      ? "bg-[var(--brand-blue)]/10"
                      : "hover:bg-[var(--brand-fg)]/[0.04]"
                  }`}
                >
                  {s.kind === "user" ? (
                    <User size={13} className="opacity-60 flex-none" />
                  ) : (
                    <CheckSquare size={13} className="opacity-60 flex-none" />
                  )}
                  <span className="truncate">{s.label}</span>
                  {s.sublabel && (
                    <span className="ml-auto text-[10px] text-[var(--brand-fg-muted)] truncate">
                      {s.sublabel}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={isPending || body.trim().length === 0}
          className="p-2 rounded-lg bg-[var(--brand-blue)] text-white disabled:opacity-40 hover:opacity-90"
          title="Enviar"
        >
          <Send size={16} />
        </button>
      </form>
    </>
  );
}

// Renders the message body with mentions replaced by pills. Mentions are
// sorted by offset and rendered as a sequence of plain-text runs and pill
// nodes. If a mention's offset points past the end of the body (stale data
// after an edit), we simply skip it.
function MessageBody({
  body,
  mentions,
  mine,
}: {
  body: string;
  mentions: ChatMentionRow[];
  mine: boolean;
}) {
  if (mentions.length === 0) {
    return (
      <div className="text-sm whitespace-pre-wrap break-words">{body}</div>
    );
  }
  const valid = mentions
    .filter((m) => m.offset >= 0 && m.offset + m.length <= body.length)
    .sort((a, b) => a.offset - b.offset);

  const nodes: React.ReactNode[] = [];
  let pos = 0;
  valid.forEach((m, i) => {
    if (m.offset > pos) {
      nodes.push(body.slice(pos, m.offset));
    }
    const label = body.slice(m.offset, m.offset + m.length);
    if (m.mentioned_task) {
      nodes.push(
        <Link
          key={`m-${i}`}
          href={`/tasks#task-${m.mentioned_task.id}`}
          className={`inline-flex items-center gap-1 px-1.5 py-px rounded font-medium ${
            mine
              ? "bg-white/25 text-white"
              : "bg-[var(--brand-blue)]/12 text-[var(--brand-blue)]"
          }`}
        >
          <CheckSquare size={11} /> {label.replace(/^@/, "")}
        </Link>,
      );
    } else if (m.mentioned_user) {
      nodes.push(
        <span
          key={`m-${i}`}
          className={`inline-flex items-center px-1.5 py-px rounded font-medium ${
            mine
              ? "bg-white/25 text-white"
              : "bg-[var(--brand-blue)]/12 text-[var(--brand-blue)]"
          }`}
        >
          {label}
        </span>,
      );
    } else {
      // Mention row exists but its target was deleted — fall back to plain text.
      nodes.push(label);
    }
    pos = m.offset + m.length;
  });
  if (pos < body.length) nodes.push(body.slice(pos));

  return (
    <div className="text-sm whitespace-pre-wrap break-words">{nodes}</div>
  );
}
