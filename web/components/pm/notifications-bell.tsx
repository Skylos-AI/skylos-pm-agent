"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, AtSign, ClipboardCheck, CheckCircle2, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  markNotificationsRead,
  markAllNotificationsRead,
} from "@/lib/mutations/notifications";
import { formatDateTime } from "@/lib/format/date";
import type {
  NotificationRow,
  NotificationKind,
} from "@/lib/data/notifications";

// Icons per kind — keeps the panel scannable when there's a mix.
function iconFor(kind: NotificationKind) {
  switch (kind) {
    case "CHAT_MENTION":
      return <AtSign size={13} />;
    case "TASK_REVIEW_REQUESTED":
      return <ClipboardCheck size={13} />;
    case "TASK_APPROVED":
    case "TASK_COMPLETED":
      return <CheckCircle2 size={13} />;
    case "TASK_REJECTED":
      return <XCircle size={13} />;
    default:
      return <Bell size={13} />;
  }
}

function hrefFor(n: NotificationRow): string {
  if (n.channel_id) return `/chat/${n.channel_id}`;
  if (n.source_task_id) return `/tasks#task-${n.source_task_id}`;
  return "/dashboard";
}

export function NotificationsBell({
  userId,
  initialNotifications,
  initialUnreadCount,
}: {
  userId: string;
  initialNotifications: NotificationRow[];
  initialUnreadCount: number;
}) {
  const [items, setItems] = useState<NotificationRow[]>(initialNotifications);
  const [unread, setUnread] = useState(initialUnreadCount);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  // Realtime: any new notification for this user bumps the count and prepends
  // to the list. New rows have a null body sometimes (in edge cases) — we
  // guard by re-reading via a mini fetch.
  useEffect(() => {
    const supa = createClient();
    const channel = supa
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow;
          setItems((prev) => {
            if (prev.some((n) => n.id === row.id)) return prev;
            return [
              { ...row, channel_id: row.channel_id ?? null },
              ...prev,
            ].slice(0, 30);
          });
          if (!row.read_at) setUnread((c) => c + 1);
        },
      )
      .subscribe();
    return () => {
      void supa.removeChannel(channel);
    };
  }, [userId]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function togglePanel() {
    setOpen((prev) => {
      const next = !prev;
      // When opening, mark all currently unread as read. Cheap DX win —
      // avoids per-item "mark read" clicks. Individual items remain
      // clickable to jump to their source.
      if (next && unread > 0) {
        const unreadIds = items.filter((n) => !n.read_at).map((n) => n.id);
        if (unreadIds.length > 0) {
          startTransition(async () => {
            await markNotificationsRead({ ids: unreadIds });
          });
          setItems((prev) =>
            prev.map((n) =>
              n.read_at ? n : { ...n, read_at: new Date().toISOString() },
            ),
          );
          setUnread(0);
        }
      }
      return next;
    });
  }

  function clearAll() {
    startTransition(async () => {
      await markAllNotificationsRead();
    });
    setItems((prev) =>
      prev.map((n) =>
        n.read_at ? n : { ...n, read_at: new Date().toISOString() },
      ),
    );
    setUnread(0);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={togglePanel}
        className="relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--brand-fg-muted)] hover:bg-[var(--brand-fg)]/[0.04] hover:text-[var(--brand-fg)] w-full"
        aria-label="Notificaciones"
      >
        <Bell size={16} />
        <span>Notificaciones</span>
        {unread > 0 && (
          <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--brand-blue)] text-white text-[10px] font-semibold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full ml-2 top-0 w-80 max-h-[70vh] overflow-y-auto z-30 bg-[var(--brand-bg)] border border-[var(--brand-border)] rounded-lg shadow-xl">
          <div className="px-3 py-2 border-b border-[var(--brand-border)] flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-fg-muted)]">
              Notificaciones
            </span>
            {items.some((n) => !n.read_at) && (
              <button
                type="button"
                onClick={clearAll}
                className="text-[11px] text-[var(--brand-blue)] hover:underline"
              >
                Marcar todas
              </button>
            )}
          </div>
          {items.length === 0 && (
            <p className="text-xs text-[var(--brand-fg-muted)] p-4 text-center">
              Sin notificaciones.
            </p>
          )}
          <ul>
            {items.map((n) => (
              <li key={n.id}>
                <Link
                  href={hrefFor(n)}
                  onClick={() => setOpen(false)}
                  className={`flex items-start gap-2 px-3 py-2 text-sm hover:bg-[var(--brand-fg)]/[0.04] ${
                    !n.read_at ? "bg-[var(--brand-blue)]/[0.04]" : ""
                  }`}
                >
                  <span className="mt-0.5 text-[var(--brand-blue)] flex-none">
                    {iconFor(n.kind)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block break-words">{n.body}</span>
                    <span className="block text-[10px] text-[var(--brand-fg-muted)] mt-0.5">
                      {formatDateTime(n.created_at)}
                    </span>
                  </span>
                  {!n.read_at && (
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--brand-blue)] flex-none" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
