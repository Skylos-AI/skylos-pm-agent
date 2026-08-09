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
import { Send, Users, User, Pencil, Trash2, X, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  sendChatMessage,
  editChatMessage,
  deleteChatMessage,
  markChatChannelRead,
} from "@/lib/mutations/chat";
import { formatDateTime } from "@/lib/format/date";
import type { ChatMessageRow } from "@/lib/data/chat";

type Member = { user_id: string; full_name: string };

export function ChatRoom({
  channelId,
  channelKind,
  title,
  members,
  currentUserId,
  initialMessages,
}: {
  channelId: string;
  channelKind: "DIRECT" | "GROUP";
  title: string;
  members: Member[];
  currentUserId: string;
  initialMessages: ChatMessageRow[];
}) {
  const [messages, setMessages] = useState<ChatMessageRow[]>(initialMessages);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const memberLookup = useMemo(
    () => new Map(members.map((m) => [m.user_id, m.full_name])),
    [members],
  );

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

  function send(e?: FormEvent) {
    e?.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || isPending) return;
    setError(null);
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
    };
    setMessages((prev) => [...prev, optimistic]);
    setBody("");
    startTransition(async () => {
      const res = await sendChatMessage({ channelId, body: trimmed });
      if (!res.ok) {
        setError(res.error.message);
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setBody(trimmed);
        return;
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? { ...m, id: res.data.id } : m)),
      );
    });
  }

  function onComposerKey(e: KeyboardEvent<HTMLTextAreaElement>) {
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
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {m.body}
                  </div>
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
        className="border-t border-[var(--brand-border)] px-4 py-3 flex items-end gap-2"
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onComposerKey}
          placeholder="Escribí un mensaje… (Enter para enviar, Shift+Enter salto de línea)"
          className="flex-1 resize-none bg-transparent border border-[var(--brand-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]/30 max-h-40"
          rows={2}
        />
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
